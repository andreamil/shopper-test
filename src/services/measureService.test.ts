import { createMeasure, confirmMeasure, listMeasures } from './measureService';
import Measure from '../models/measureModel';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from '@google/generative-ai/server';

jest.mock('../models/measureModel');
jest.mock('@google/generative-ai');
jest.mock('@google/generative-ai/server');
jest.mock('sequelize');
jest.mock('fs');

describe('Measure Service', () => {

  describe('createMeasure', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a new measure successfully', async () => {
      const mockData = {
        image: 'data:image/png;base64,valid',
        customer_code: '1234',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        measure_type: 'WATER',
      };

      const mockMeasure = { image_url: 'http://example.com', value: 100, uuid: 'measure-uuid' };
      (Measure.create as jest.Mock).mockResolvedValue(mockMeasure as unknown as Measure);

      const mockUploadResponse = { file: { mimeType: 'image/png', uri: 'http://example.com' } };
      (GoogleAIFileManager.prototype.uploadFile as jest.Mock).mockResolvedValue(mockUploadResponse);
      (GoogleGenerativeAI.prototype.getGenerativeModel as jest.Mock).mockReturnValue({
        generateContent: () => ({ response: { text: () => '100' } })
      });

      const result = await createMeasure(mockData);
      expect(result).toEqual(mockMeasure);
    });

    it('should reject if image format is invalid', async () => {
      const mockData = {
        image: 'invalid-image-data',
        customer_code: '1234',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        measure_type: 'WATER',
      };

      await expect(createMeasure(mockData)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Formato de imagem inválido',
      });
    });

    it('should reject if customer code is invalid', async () => {
      const mockData = {
        image: 'data:image/png;base64,valid',
        customer_code: 'invalid code',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        measure_type: 'WATER',
      };

      await expect(createMeasure(mockData)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Formato de código de cliente inválido',
      });
    });

    it('should reject if measure datetime is invalid', async () => {
      const mockData = {
        image: 'data:image/png;base64,valid',
        customer_code: '1234',
        measure_datetime: 'invalid-date',
        measure_type: 'WATER',
      };

      await expect(createMeasure(mockData)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Formato de data e hora de medida inválido',
      });
    });

    it('should reject if measure type is invalid', async () => {
      const mockData = {
        image: 'data:image/png;base64,valid',
        customer_code: '1234',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        measure_type: 'INVALID_TYPE',
      };

      await expect(createMeasure(mockData)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Tipo de medida inválido',
      });
    });

    it('should reject if measure already exists', async () => {
      const mockData = {
        image: 'data:image/png;base64,valid',
        customer_code: '1234',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        measure_type: 'WATER',
      };

      (Measure.findOne as jest.Mock).mockResolvedValue({} as Measure);

      await expect(createMeasure(mockData)).rejects.toEqual({
        error_code: 'DOUBLE_REPORT',
      });
    });
  });

  describe('confirmMeasure', () => {
    it('should confirm a measure successfully', async () => {
      const mockMeasure = {
        uuid: 'uuid',
        has_confirmed: false,
        save: jest.fn().mockResolvedValue(true),
        value: 0
      };
      (Measure.findByPk as jest.Mock).mockResolvedValue(mockMeasure as unknown as Measure);

      await confirmMeasure('uuid', 150);
      expect(mockMeasure.value).toBe(150);
      expect(mockMeasure.has_confirmed).toBe(true);
      expect(mockMeasure.save).toHaveBeenCalled();
    });

    it('should reject if UUID format is invalid', async () => {
      await expect(confirmMeasure('', 150)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Dados inválidos ou ausentes',
      });
    });

    it('should reject if measure not found', async () => {
      (Measure.findByPk as jest.Mock).mockResolvedValue(null);

      await expect(confirmMeasure('uuid', 150)).rejects.toEqual({
        error_code: 'MEASURE_NOT_FOUND',
      });
    });

    it('should reject if measure is already confirmed', async () => {
      const mockMeasure = {
        uuid: 'uuid',
        has_confirmed: true,
        save: jest.fn().mockResolvedValue(true),
        value: 0
      };
      (Measure.findByPk as jest.Mock).mockResolvedValue(mockMeasure as unknown as Measure);

      await expect(confirmMeasure('uuid', 150)).rejects.toEqual({
        error_code: 'CONFIRMATION_DUPLICATE',
      });
    });

    it('should reject if confirmed_value is invalid', async () => {
      await expect(confirmMeasure('uuid', NaN)).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Valor de confirmação inválido',
      });
    });
  });

  describe('listMeasures', () => {
    it('should return a list of measures', async () => {
      const mockMeasures = [{
        uuid: 'uuid',
        measure_type: 'WATER',
        measure_datetime: '2023-08-28T00:00:00.000Z',
        has_confirmed: false,
        image_url: 'http://example.com'
      } as unknown as Measure];
      (Measure.findAll as jest.Mock).mockResolvedValue(mockMeasures);

      const result = await listMeasures('1234', 'WATER');
      expect(result).toEqual(mockMeasures);
    });

    it('should reject if no measures are found', async () => {
      (Measure.findAll as jest.Mock).mockResolvedValue([]);

      await expect(listMeasures('1234', 'WATER')).rejects.toEqual({
        error_code: 'MEASURES_NOT_FOUND',
      });
    });

    it('should reject if customer code is invalid', async () => {
      await expect(listMeasures('invalid code', 'WATER')).rejects.toEqual({
        error_code: 'INVALID_DATA',
        error_description: 'Formato de código de cliente inválido',
      });
    });

    it('should reject if measure type is invalid', async () => {
      await expect(listMeasures('1234', 'INVALID_TYPE')).rejects.toEqual({
        error_code: 'INVALID_TYPE',
      });
    });
  });
});
