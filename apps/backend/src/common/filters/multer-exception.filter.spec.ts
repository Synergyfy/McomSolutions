import { MulterExceptionFilter } from './multer-exception.filter';
import { MulterError } from 'multer';

describe('MulterExceptionFilter (Phase 1C)', () => {
  const filter = new MulterExceptionFilter();

  const makeHost = () => {
    const res: any = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: any) {
        res.body = payload;
        return res;
      },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: '/api/v1/upload' }),
      }),
    } as any;
    return { host, res };
  };

  it('maps LIMIT_FILE_SIZE to 413', () => {
    const { host, res } = makeHost();
    filter.catch(new MulterError('LIMIT_FILE_SIZE'), host);
    expect(res.statusCode).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('maps other multer errors to 400', () => {
    const { host, res } = makeHost();
    filter.catch(new MulterError('LIMIT_UNEXPECTED_FILE'), host);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
