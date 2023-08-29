import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ControlTCPClient } from 'kgarage-ctl/dist/tcp';
import { ExampleHomebridgePlatform } from './platform';
import { z } from 'zod';

// const s= Characteristic.CurrentDoorState

type KGarageState = {
  current: number;
  target: number;
  isObstructed: boolean;
};

export class KGarageDoorPlatformAccessory {
  private service: Service;
  private state: KGarageState;
  private client?: ControlTCPClient;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.state = {
      current: this.platform.Characteristic.CurrentDoorState.CLOSED,
      target: this.platform.Characteristic.TargetDoorState.CLOSED,
      isObstructed: false,
    };

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Postek Company',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'GD:prototype:1')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        '00-00-00-000000',
      );

    this.service =
      this.accessory.getService(this.platform.Service.GarageDoorOpener) ||
      this.accessory.addService(this.platform.Service.GarageDoorOpener);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

    // required characteristics: Current Door State, Target Door State, Obstruction Detected
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .onGet(this.getCurrentDoorState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .onSet(this.setTargetDoorState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.ObstructionDetected)
      .onGet(this.getObstructionDetected.bind(this));

    this.service.setCharacteristic(
      this.platform.Characteristic.CurrentDoorState,
      this.state.current,
    );
    this.service.setCharacteristic(
      this.platform.Characteristic.TargetDoorState,
      this.state.target,
    );

    this.client = new ControlTCPClient(accessory.context.device.secret);
    this.client.setTimeout(10_000);
    this.platform.log.info(
      `Connecting to ${accessory.context.device.address}:${accessory.context.device.port}`,
    );
    this.client.connect(
      accessory.context.device.port,
      accessory.context.device.address,
    );

    this.client.once('connect', () => {
      this.platform.log.info('Connected to device!');
    });

    this.client.on('data', (data) => {
      const states: unknown = JSON.parse(data.toString());

      const state = z
        .object({
          current: z.union([
            z.literal(0),
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
          ]),
          target: z.union([z.literal(0), z.literal(1)]),
        })
        .parse(states);

      if (this.state.current !== state.current) {
        this.platform.log.info(
          `Current state changed from ${this.state.current} to ${state.current}`,
        );
      }

      if (this.state.target !== state.target) {
        this.platform.log.info(
          `Target state changed from ${this.state.target} to ${state.target}`,
        );
      }

      this.state = {
        ...state,
        isObstructed: this.state.isObstructed,
      };

      this.service.setCharacteristic(
        this.platform.Characteristic.CurrentDoorState,
        this.state.current,
      );

      this.service.setCharacteristic(
        this.platform.Characteristic.TargetDoorState,
        this.state.target,
      );

      this.platform.log.debug(`Received state: ${JSON.stringify(this.state)}`);
    });

    this.client.on('error', (error) => {
      this.platform.log.error(String(error));

      this.platform.log.info('Reconnecting...');
      setTimeout(() => {
        this.client?.connect(
          accessory.context.device.port,
          accessory.context.device.address,
        );
      }, 2000);
    });
  }

  async getCurrentDoorState(): Promise<CharacteristicValue> {
    await this.client?.waitForSync();
    return this.state.current;
  }

  async setTargetDoorState(value: CharacteristicValue) {
    this.client?.sendControlPacket({
      action: 'SET',
      target: value as 0 | 1,
    });
    this.platform.log.debug(`Set target to ${value}`);
  }

  async getObstructionDetected(): Promise<CharacteristicValue> {
    return this.state.isObstructed;
  }
}
