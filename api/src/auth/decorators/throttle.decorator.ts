import { Throttle } from "@nestjs/throttler";

// Strict rate limiting for sensitive authentication operations (login, password reset)
export const ThrottleAuth = () =>
  Throttle({ default: { limit: 5, ttl: 60000 } }); // 5 per minute

// Very strict rate limiting for critical operations (SMS, password reset)
export const ThrottleStrict = () =>
  Throttle({ default: { limit: 3, ttl: 60000 } }); // 3 per minute

// Moderate rate limiting for general authenticated operations
export const ThrottleModerate = () =>
  Throttle({ default: { limit: 20, ttl: 60000 } }); // 20 per minute

// Relaxed rate limiting for read operations
export const ThrottleRelaxed = () =>
  Throttle({ default: { limit: 100, ttl: 60000 } }); // 100 per minute
