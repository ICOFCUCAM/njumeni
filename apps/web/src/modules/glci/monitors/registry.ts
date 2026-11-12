import type { MonitorAdapter } from '../monitor.ts';
import { createAtomFeedMonitor, createJsonListingMonitor, createRssFeedMonitor } from './feeds.ts';
import { createLovdataListingMonitor } from './lovdata-listing.ts';

/**
 * Monitor adapters available to the GLCI worker. A new country or source format needs only a new
 * adapter here; targets, schedules and currency rules are data (J-GLCI-4).
 */
export const glciMonitorAdapters: readonly MonitorAdapter[] = Object.freeze([
  createLovdataListingMonitor(),
  createAtomFeedMonitor(),
  createRssFeedMonitor(),
  createJsonListingMonitor(),
]);
