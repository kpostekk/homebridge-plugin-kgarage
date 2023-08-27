import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { KGarageDoorPlatformAccessory } from './platformAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // KGarage Door
    const uuid = this.api.hap.uuid.generate('kGarage:' + this.config.address + ':' + this.config.port);
    const existingKGarageAccessory = this.accessories.find(accessory => accessory.UUID === uuid);


    if (existingKGarageAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingKGarageAccessory.displayName);
      new KGarageDoorPlatformAccessory(this, existingKGarageAccessory);
    } else {
      this.log.info('Adding new accessory:', this.config.name);

      const accessory = new this.api.platformAccessory(this.config.name!, uuid);
      accessory.context.device = this.config;
      new KGarageDoorPlatformAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
