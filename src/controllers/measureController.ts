import { Request, Response } from 'express';
import { createMeasure, confirmMeasure, listMeasures } from '../services/measureService';
import { BaseError } from 'sequelize';

const errorMap: { [key: string]: { status: number; message: string } } = {
  DOUBLE_REPORT: { status: 409, message: "Leitura do mês já realizada" },
  MEASURE_NOT_FOUND: { status: 404, message: "Leitura não encontrada" },
  CONFIRMATION_DUPLICATE: { status: 409, message: "Leitura já confirmada" },
  INVALID_TYPE: { status: 400, message: 'Tipo de medição não permitida' },
  MEASURES_NOT_FOUND: { status: 404, message: "Nenhuma leitura encontrada" },
};

const handleErrorResponse = (error: any, res: Response) => {
  const { error_code, error_description } = error;
  const mappedError = errorMap[error_code];

  if (mappedError) {
    return res.status(mappedError.status).json({ error_code, error_description: mappedError.message });
  }

  if (error instanceof BaseError) {
    return res.status(500).json({ error_code: "SEQUELIZE_ERROR", error_description: error.message });
  }

  if (error_code && error_description) {
    return res.status(400).json({ error_code, error_description });
  }

  return res.status(500).json({ error_code: "INTERNAL_ERROR", error_description: error.message });
};

export const uploadMeasure = async (req: Request, res: Response) => {
  try {
    const measure = await createMeasure(req.body);
    return res.status(200).json({
      image_url: measure.image_url,
      measure_value: measure.value,
      measure_uuid: measure.uuid,
    });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const confirmMeasureValue = async (req: Request, res: Response) => {
  try {
    const { measure_uuid, confirmed_value } = req.body;
    await confirmMeasure(measure_uuid, confirmed_value);
    return res.status(200).json({ success: true });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const listCustomerMeasures = async (req: Request, res: Response) => {
  try {
    const measures = await listMeasures(req.params.customer_code, req.query.measure_type as string);
    return res.status(200).json({
      customer_code: req.params.customer_code,
      measures: measures.map(measure => ({
        measure_uuid: measure.uuid,
        measure_datetime: measure.measure_datetime,
        measure_type: measure.measure_type,
        has_confirmed: measure.has_confirmed,
        image_url: measure.image_url,
      })),
    });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};