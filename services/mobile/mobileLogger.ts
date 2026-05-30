import { logger } from '../logger';

export type MobileLogChannel =
  | 'Mobile'
  | 'Android'
  | 'PWA'
  | 'Socket'
  | 'Reconnect'
  | 'Background'
  | 'WakeLock'
  | 'Notifications';

export const mobileLog = {
  debug: (msg: string, channel: MobileLogChannel, data?: unknown) =>
    logger.debug(msg, channel, data),
  info: (msg: string, channel: MobileLogChannel, data?: unknown) =>
    logger.info(msg, channel, data),
  warn: (msg: string, channel: MobileLogChannel, data?: unknown) =>
    logger.warn(msg, channel, data),
  error: (msg: string, channel: MobileLogChannel, data?: unknown) =>
    logger.error(msg, channel, data),
};
