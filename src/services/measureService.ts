import 'dotenv/config';
import Measure from '../models/measureModel';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const apiKey = process.env.GEMINI_API_KEY || '';
const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);
const modelParams = { model: "gemini-1.5-pro" };

const isValidString = (value: any): boolean => typeof value === 'string' && value.trim() !== '';
const isValidDate = (dateString: string): boolean => !isNaN(new Date(dateString).getTime());
const isValidMeasureType = (type: string): boolean => ['WATER', 'GAS'].includes(type.toUpperCase());
const isValidBase64Image = (base64: string): boolean => {
  const regex = /^data:image\/(png|jpeg|jpg|webp|heic|heif);base64,[A-Za-z0-9+/]+={0,2}$/;
  return typeof base64 === 'string' && regex.test(base64);
};

const saveTemporaryImage = (base64: string, measureType: string, customerCode: string, measureMonth: number, measureYear: number) => {
  const imageExtension = base64.split(';')[0].split('/')[1];
  const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const tempDir = path.join(__dirname, '../../uploads/tmp');
  const filePath = path.join(tempDir, `${measureType}-${customerCode}-${measureMonth + 1}-${measureYear}.${imageExtension}`);

  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return { filePath, mimeType: `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}` };
};

const uploadImage = async (filePath: string, mimeType: string, displayName: string) => {
  const uploadResponse = await fileManager.uploadFile(filePath, { mimeType, displayName });
  fs.unlinkSync(filePath);
  return uploadResponse;
};

const extractMeasureValue = async (uploadResponse: any) => {
  const result = await genAI.getGenerativeModel(modelParams).generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri,
      },
    },
    { text: "Return an integer corresponding to the measured value on the device if it is a water or gas meter; otherwise, return 'ERROR'." },
  ]);

  const measureValue = Number(result.response.text());
  return measureValue || 0;
};

const findExistingMeasure = async (customerCode: string, measureType: string, measureDate: Date) => {
  const measureMonth = measureDate.getMonth();
  const measureYear = measureDate.getFullYear();

  return Measure.findOne({
    where: {
      customer_code: customerCode,
      measure_type: measureType,
      measure_datetime: {
        [Op.between]: [new Date(measureYear, measureMonth, 1), new Date(measureYear, measureMonth + 1, 0)],
      },
    },
  });
};

export async function createMeasure(data: any) : Promise<Measure>{
  const { image, customer_code, measure_datetime, measure_type } = data;

  if (!image || !customer_code || !measure_datetime || !measure_type) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Dados inválidos ou ausentes' });
  if (!isValidBase64Image(image)) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Formato de imagem inválido' });
  if (!isValidString(customer_code) || customer_code.includes(' ')) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Formato de código de cliente inválido' });
  if (!isValidDate(measure_datetime)) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Formato de data e hora de medida inválido' });
  if (!isValidMeasureType(measure_type)) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Tipo de medida inválido' });

  const measureType = measure_type.toUpperCase();
  const measureDate = new Date(measure_datetime);

  const existingMeasure = await findExistingMeasure(customer_code, measureType, measureDate);
  if (existingMeasure) return Promise.reject({ error_code: 'DOUBLE_REPORT' });

  const { filePath, mimeType } = saveTemporaryImage(image, measureType, customer_code, measureDate.getMonth(), measureDate.getFullYear());
  const uploadResponse = await uploadImage(filePath, mimeType, `${measureType} measure by ${customer_code} - ${measureDate.getMonth() + 1}/${measureDate.getFullYear()}`);

  const measureValue = await extractMeasureValue(uploadResponse);

  return Measure.create({
    customer_code,
    measure_datetime: measureDate,
    measure_type: measureType,
    value: measureValue,
    image_url: uploadResponse.file.uri,
  });
}

export const confirmMeasure = async (uuid: string, confirmed_value: number) => {
  if (!uuid || confirmed_value===undefined) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Dados inválidos ou ausentes' });
  if (!isValidString(uuid)) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Formato de UUID inválido' });
  if (isNaN(Number(confirmed_value))) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Valor de confirmação inválido' });

  const measure = await Measure.findByPk(uuid);
  if (!measure) return Promise.reject({ error_code: 'MEASURE_NOT_FOUND' });
  if (measure.has_confirmed) return Promise.reject({ error_code: 'CONFIRMATION_DUPLICATE' });

  measure.value = confirmed_value;
  measure.has_confirmed = true;
  return measure.save();
};

export const listMeasures = async (customer_code: string, measure_type: string) => {
  if (!measure_type || !customer_code) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Dados inválidos ou ausentes' });
  if (!isValidString(customer_code) || customer_code.includes(' ')) return Promise.reject({ error_code: 'INVALID_DATA', error_description: 'Formato de código de cliente inválido' });
  if (!isValidMeasureType(measure_type)) return Promise.reject({ error_code: 'INVALID_TYPE' });

  const measures = await Measure.findAll({
    where: { 
      customer_code,
      measure_type: measure_type.toUpperCase(),
    },
  });

  if (measures.length === 0) return Promise.reject({ error_code: 'MEASURES_NOT_FOUND' });

  return measures;
};