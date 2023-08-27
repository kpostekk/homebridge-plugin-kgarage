import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ControlTCPClient } from 'kgarage-ctl/dist/tcp';
import { ExampleHomebridgePlatform } from './platform';

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
    this.client.connect(
      accessory.context.device.port,
      accessory.context.device.address,
    );
    setInterval(() => {
      if (this.client?.readable) {
        return;
      }
      this.platform.log.warn(
        'Reconnecting to ' + accessory.context.device.name,
      );
      this.client?.connect(
        accessory.context.device.port,
        accessory.context.device.address,
      );
    }, 12_000);

    this.client.on('data', (data) => {
      const state = Number(data);
      this.state.current = state;
      this.service.setCharacteristic(
        this.platform.Characteristic.CurrentDoorState,
        state,
      );
    });

    this.client.on('error', (error) => {
      this.platform.log.error(String(error));
    });
  }

  async getCurrentDoorState(): Promise<CharacteristicValue> {
    return this.state.current;
  }

  async setTargetDoorState(value: CharacteristicValue) {
    this.client?.sendControlPacket({
      action: 'SET',
      target: value as 0 | 1,
      timestamp: Date.now(),
    });
  }

  async getObstructionDetected(): Promise<CharacteristicValue> {
    return this.state.isObstructed;
  }
}
