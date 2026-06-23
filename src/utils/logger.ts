import crypto from 'crypto';

export interface LogPayload {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  requestId?: string;
  message: string;
  [key: string]: any;
}

export const log = (
  level: LogPayload['level'],
  message: string,
  meta: Record<string, any> = {},
  requestId?: string
) => {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'ap-backend',
    requestId,
    message,
    ...meta,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
};

export const logger = {
  info: (msg: string, meta?: Record<string, any>, reqId?: string) => log('info', msg, meta, reqId),
  warn: (msg: string, meta?: Record<string, any>, reqId?: string) => log('warn', msg, meta, reqId),
  error: (msg: string, meta?: Record<string, any>, reqId?: string) => log('error', msg, meta, reqId),
  debug: (msg: string, meta?: Record<string, any>, reqId?: string) => log('debug', msg, meta, reqId),
};
