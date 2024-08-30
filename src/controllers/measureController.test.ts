import { Request, Response } from 'express';
import { uploadMeasure, confirmMeasureValue, listCustomerMeasures } from './measureController';
import { createMeasure, confirmMeasure, listMeasures } from '../services/measureService';

jest.mock('../services/measureService');

describe('Measure Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));

    req = {};
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadMeasure', () => {
    it('should return 200 and the measure details on success', async () => {
      const measureMock = {
        image_url: 'http://example.com/image.jpg',
        value: 100,
        uuid: 'measure-uuid',
      };

      req.body = { image: 'image_data', type: 'WATER' };

      (createMeasure as jest.Mock).mockResolvedValue(measureMock);

      await uploadMeasure(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        image_url: measureMock.image_url,
        measure_value: measureMock.value,
        measure_uuid: measureMock.uuid,
      });
    });

    it('should return the correct error response on failure', async () => {
      (createMeasure as jest.Mock).mockRejectedValue({ error_code: 'INVALID_TYPE' });

      await uploadMeasure(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error_code: 'INVALID_TYPE',
        error_description: 'Tipo de medição não permitida',
      });
    });
  });

  describe('confirmMeasureValue', () => {
    it('should return 200 and success on successful confirmation', async () => {
      req.body = { measure_uuid: 'measure-uuid', confirmed_value: 100 };

      await confirmMeasureValue(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    it('should return the correct error response on failure', async () => {
      (confirmMeasure as jest.Mock).mockRejectedValue({ error_code: 'CONFIRMATION_DUPLICATE' });

      req.body = { measure_uuid: 'measure-uuid', confirmed_value: 100 };
      await confirmMeasureValue(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        error_code: 'CONFIRMATION_DUPLICATE',
        error_description: 'Leitura já confirmada',
      });
    });
  });

  describe('listCustomerMeasures', () => {
    it('should return 200 and a list of measures on success', async () => {
      const measuresMock = [
        {
          uuid: 'measure-uuid-1',
          measure_datetime: new Date(),
          measure_type: 'WATER',
          has_confirmed: true,
          image_url: 'http://example.com/image1.jpg',
        },
        {
          uuid: 'measure-uuid-2',
          measure_datetime: new Date(),
          measure_type: 'GAS',
          has_confirmed: false,
          image_url: 'http://example.com/image2.jpg',
        },
      ];

      req.params = { customer_code: 'customer-123' };
      req.query = { measure_type: 'WATER' };

      (listMeasures as jest.Mock).mockResolvedValue(measuresMock);

      await listCustomerMeasures(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        customer_code: 'customer-123',
        measures: measuresMock.map(measure => ({
          measure_uuid: measure.uuid,
          measure_datetime: measure.measure_datetime,
          measure_type: measure.measure_type,
          has_confirmed: measure.has_confirmed,
          image_url: measure.image_url,
        })),
      });
    });

    it('should return the correct error response on failure', async () => {
      (listMeasures as jest.Mock).mockRejectedValue({ error_code: 'MEASURES_NOT_FOUND' });

      req.params = { customer_code: 'customer-123' };
      req.query = { measure_type: 'WATER' };

      await listCustomerMeasures(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error_code: 'MEASURES_NOT_FOUND',
        error_description: 'Nenhuma leitura encontrada',
      });
    });
  });
});
