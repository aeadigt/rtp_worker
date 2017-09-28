
import {EventEmitter} from 'events';
import {Buffer} from 'buffer';

export class Stt extends EventEmitter {
    private stt: any;
    private lastSttOpt: any;
    private in: any;

    constructor() {
        super();

        this.stt;
        this.lastSttOpt;
        this.in = {};

        this.stt = require('./sttMethods');

        // ********* Обработка событий *********
        this.on('stt', (payload: Buffer) => {
            if (this.in && this.in.stt_detect) {
                this.speechToText(payload);
            }
        });
        
        this.on('rec', (params: any) => {
            this.rec(params);
        });
    }

    private speechToText(payload: Buffer) {
        let options = this.in.options && this.in.options.options;

        if (options) {
            if (!this.stt.isReady()) {
                if (!this.stt.isConnecting()) {
                    // (process as any).send({ action: 'start_stt', params: options });
                    this.emit('event', { action: 'start_stt', params: options });

                    this.stt.init(options, (error: any, params: any) => {
                            let res: any = {
                                action: 'sttInit'
                            };

                            if (error)
                                res.error = error;
                            else {
                                res.params = params;
                            }

                            // (process as any).send(res);
                            this.emit('event', res);
                        });
                }
            } else {
                this.stt.send(payload);
            }
        }
    }

    // ******************** Установка параметров ********************
    private rec(params: any) {
        for (let key in params) {
            this.in[key] = params[key];
        }

        if (params && params.stt_detect) {
            if (JSON.stringify(params) != JSON.stringify(this.lastSttOpt) &&
                this.stt && this.stt.isReady())
                this.stt.stop();
            this.lastSttOpt = params;
        }
    }
}