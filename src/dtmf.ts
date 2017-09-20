import {EventEmitter} from 'events';
import {Buffer} from 'buffer';

export class Dtmf extends EventEmitter {
    private dtmf_decoder: any;
    private dtmf_mode: any;
    private change_flag: any;
    private prev_dtmf_dur: any;
    private audioPayload: any;
    private g711: any;
    private in: any;

    constructor() {
        super();

        this.dtmf_decoder = require('./dtmfDecoder');
        this.dtmf_mode;
        this.change_flag;
        this.prev_dtmf_dur = 0;
        this.audioPayload = 0; //RFC3551//PCMU,
        this.g711 = new(require('./G711').G711)();
        this.in = {};

        this.on('dtmf', (data: any) => {
            if (this.in && this.in.dtmf_detect) {
                this.setDtmfMode();
                this.checkDtmf(data);
            }
        });

        this.on('payload', (payload: any) => {
            if (this.in && this.in.dtmf_detect) {
                this.dtmfDetect(payload);
            }
        });
    }

    setDtmfMode() {
        // (process as any).send('!!! newDtmf: ' + data.source);
        if (this.dtmf_mode === 'inband') {
            this.change_flag = true;
        }

        if (!this.dtmf_mode || this.change_flag) {
            this.dtmf_mode = 'rfc2833';
        }
        (process as any).send({
            action: 'set_dtmf_mode',
            params: this.dtmf_mode
        });
    }

    checkDtmf(data: any) {
        let dtmf = this.dtmf_data(data);

        if (dtmf.duration < this.prev_dtmf_dur || this.prev_dtmf_dur == 0) {
            if (!this.change_flag) {
                (process as any).send({
                    action: 'dtmf_key',
                    params: {
                        key: dtmf.event
                    }
                });
            }
            this.change_flag = false;
        }

        this.prev_dtmf_dur = dtmf.duration;
    }

    dtmf_data (pkt: any) {
        let keys: any = {
            10: '*',
            11: '#',
            12: 'A',
            13: 'B',
            14: 'C',
            15: 'D'
        };

        let key = pkt[0];

        if (keys[key]) {
            key = keys[key];
        }

        let result = {
            event: key,
            volume: (pkt[1] >>> 2),
            duration: (pkt[2] << 8 | pkt[3])
        };

        return result;
    }

    dtmfDetect(payload: any) {
        if (this.dtmf_mode !== 'rfc2833') {
            this.dtmf_decoder.filter(payload, (c: any) => {
                if (!this.dtmf_mode) {
                    this.dtmf_mode = 'inband';
                    this.setDtmfMode();
                }
                if (c.key !== undefined) {
                    (process as any).send({
                        action: 'dtmf_key',
                        params: {
                            key: c.key
                        }
                    });
                    let last_key = c.key;
                };
                if (c.seq !== undefined)
                    (process as any).send({
                        action: 'dtmf_seq',
                        params: {
                            key: c.seq
                        }
                    });
            });
        }
    }

    buf2array (buf: any) {
        let data = [];
        for (let i = 0; i < buf.length; i++) {
            if (this.audioPayload)
                data.push(this.g711.alaw2linear(buf.readInt8(i)));
            else
                data.push(this.g711.ulaw2linear(buf.readInt8(i)));
        }
        return data;
    }

    // ******************** Установка параметров ********************
    private rec(params: any) { 
        for (let key in params) {
            this.in[key] = params[key];
        }
    }

}