import {EventEmitter} from 'events';
import {Buffer} from 'buffer';

export class Socket extends EventEmitter {
    private client: any;
    private stun: any;
    private stream_on: any;

    private audioPayload: any;
    private wavDataOffset: any;
    private RtpPacket: any;

    
    private g711: any;

    constructor() {
        super();

        this.client = require("dgram").createSocket('udp4');
        this.stun = require('vs-stun');
        this.stream_on;

        this.audioPayload = 0; //RFC3551//PCMU,
        this.wavDataOffset = 58;
        this.RtpPacket = require('./rtppacket').RtpPacket;

        this.g711 = new(require('./G711').G711)();

        // ********* Обработка событий *********
        this.on('addBuffer', (buffer: Buffer) => {
            this.send(buffer);
        });

        this.on('rtpInPort', (params: any) => {
            this.rtpInPort(params);
        });

        this.on('init', (params: any) => {
            this.init(params);
        });

        this.on('rec', (params: any) => {
            this.rec(params);
        });
    }

    // ******************** Поднять Rtp поток на порту ********************
    private rtpInPort(params: any) {
        if (params && params.audioCodec === 'PCMA')
            this.audioPayload = 8;

        this.client.bind(0, () => {
            var rtpIn: any = { port: this.client.address().port };

            if (params && params.publicIP && params.stunServer) {
                rtpIn.host = params.publicIP;

                this.stun.resolve(this.client, params.stunServer, (err: any, value: any) => {
                    if (value && value.public) {
                        rtpIn = value.public
                    }
                    // (process as any).send({ action: 'rtpInPort', params: rtpIn });
                    this.emit('proxyData', { action: 'rtpInPort', params: rtpIn });
                }, { count: 1, timeout: 100 });
            } else {
                // (process as any).send({ action: 'rtpInPort', params: rtpIn });
                this.emit('proxyData', { action: 'rtpInPort', params: rtpIn });
            }
        })
        return;
    }

    // ******************** Инициализация ********************
    private init(params: any) {

        let buf2array = (buf: any) => {
            var data = [];
            for (var i = 0; i < buf.length; i++) {
                if (this.audioPayload)
                    data.push(this.g711.alaw2linear(buf.readInt8(i)));
                else
                    data.push(this.g711.ulaw2linear(buf.readInt8(i)));
            }
            return data;
        }

        let rtp_data = (pkt: any) => {
            return {
                type: (pkt[1] & 0x7F),
                seq: (pkt[2] << 8 | pkt[3]),
                time: (pkt[4] << 24 | pkt[5] << 16 | pkt[6] << 8 | pkt[7]),
                source: pkt.slice(12, pkt.length)
            };
        }

        this.client.params = params;

        let clientParams = '';

        for (let key in this.client.params.in) {
            clientParams += '\r\n' + key + ' = ' + this.client.params.in[key];
        }

        this.client.on("message", (msg: any, rinfo: any) => {
            if (!this.stream_on) {
                this.emit('proxyData', {
                    action: 'stream_on',
                    params: {
                        port: this.client.address().port,
                        rinfo: rinfo
                    }
                });
                // (process as any).send({
                //     action: 'stream_on',
                //     params: {
                //         port: this.client.address().port,
                //         rinfo: rinfo
                //     }
                // });
                this.stream_on = true;
            }
            var params = this.client.params.in;

            if (!params.dtmf_detect && !params.stt_detect && !params.file && !params.media_stream)
                return;

            var data = rtp_data(msg);

            if (data.type == params.dtmf_payload_type) {
                this.emit('dtmf', data.source);
            } else {
                if (data.type == this.audioPayload) {

                    if (params.media_stream) {
                        this.emit('proxyData', {
                            action: 'mediaStream',
                            params: {
                                data: Array.from(new Uint8Array(data.source)) // for webkit - data.source
                            }
                        });
                        // (process as any).send({
                        //     action: 'mediaStream',
                        //     params: {
                        //         data: Array.from(new Uint8Array(data.source)) // for webkit - data.source
                        //     }
                        // });
                    }

                    if (params.rec && params.file) {
                        this.emit('writeDataIn', data.source);
                    }

                    let payload = buf2array(data.source);

                    this.emit('stt', payload);
                    this.emit('payload', payload);
                }
            }
        });

        this.client.on('close', () => {
            this.emit('close');
        });

        this.sendFreePacket();
    }

    // ******************** Отправка пустого пакета ********************    
    private sendFreePacket() {
        let rtpPacket = new this.RtpPacket(new Buffer(1)); //send empty packet
        rtpPacket.time += 1;
        rtpPacket.seq++;
        this.client.send(rtpPacket.packet, 0, rtpPacket.packet.length, this.client.params.out.port, this.client.params.out.ip);
    }

    // ******************** Закрыть сокет ********************    
    private close() {
        this.client.close();
    }

    // ******************** Отправить буфер ********************
    private send(buffer: Buffer) {
        // (process as any).send('Send Buffer: ' + buffer);
        this.client.send(buffer, 0, buffer.length, this.client.params.out.port, this.client.params.out.ip, (err: any) => {
            if (err) {
                // (process as any).send(err);
                this.emit('proxyData', err);
            }
        });
    }

    // ******************** Установка параметров ********************
    private rec(params: any) { 
        for (var key in params) {
            this.client.params.in[key] = params[key];
        }
    }
}