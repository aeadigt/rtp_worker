import {EventEmitter} from 'events';
import * as FileStream from 'fs';
import {spawn} from 'child_process';

export class Recorder extends EventEmitter {
    private audio_stream_out: any;
    private rtp_packet: any;
    private rec_start: any;
    private bufferSize: number; 
    private audioPayload: any;
    private inrec: any;
    private in: any;
    private wav: any;
    private audio_stream_in: any;
    private rec_type: any;
    private fs: any;

    constructor() {
        super();

        this.bufferSize = 320; //8*30 //30 ms
        this.rec_start;
        this.audioPayload = 0; //RFC3551//PCMU
        this.audio_stream_out;
        this.audio_stream_in;
        this.wav = require('wav');
        this.in = {};
        this.rec_type;
        this.fs = FileStream;

        // ********* Обработка событий *********
        this.on('startPlayFile', () => {
            // (process as any).send('rtpRecorder [startPlayFile]');
            this.startPlayFile();
        });

        this.on('writeDataOut', (buffer: Buffer) => {
            // (process as any).send('rtpRecorder [writeData] buffer: ' + buffer);
            this.writeDataOut(buffer);
        });

        this.on('writeDataIn', (buffer: Buffer) => {
            // (process as any).send('rtpRecorder [writeData] buffer: ' + buffer);
            this.writeDataIn(buffer);
        });

        this.on('socketClose', () => {
            this.closeStreams();
        });

        this.on('rec', (params: any) => {
            this.rec(params);
        });
    }

    // ******************** Событие старта файла ********************    
    private startPlayFile() { 
        if (this.in.rec && this.in.file && this.audio_stream_out) {
            let rec_end = process.hrtime(this.rec_start),
                streamTimeout = rec_end[0] * 1000 + rec_end[1] / 1000000;

            let silenceLen: any = (streamTimeout - (this.bufferSize / 8)).toFixed(); //ms

            if (silenceLen > (this.bufferSize / 8)) { //прошло больше времени размера пакета
                let silenceBuf = new Buffer(silenceLen * 8);
                silenceBuf.fill(this.audioPayload ? 213 : 127); //тишина 127 - pcmu, 213 - pcma

                if (!this.audio_stream_out.ending) {
                    this.audio_stream_out.write(silenceBuf);
                }
            }
        }
    }

    // ******************** Запись данных ********************    
    private writeDataOut(buffer: Buffer) { 
        if (buffer && this.in.rec && this.in.file && this.audio_stream_out) {
            this.rec_start = process.hrtime();

            if (!this.audio_stream_out.ending) {
                this.audio_stream_out.write(buffer);
            }
        }
    }

    // ******************** Запись данных ********************    
    private writeDataIn(buffer: Buffer) {
        if (this.rec && ('file' in this.in)) {
            if (!this.audio_stream_out) {
                this.audio_stream_out = new this.wav.FileWriter(this.in.file + '.out', {
                    format: this.audioPayload ? 6 : 7, //7 pcmu, 6 pcma
                    channels: 1,
                    sampleRate: 8000,
                    bitDepth: 8
                });
            }

            if (!this.audio_stream_in) {
                this.audio_stream_in = new this.wav.FileWriter(this.in.file + '.in', {
                    format: this.audioPayload ? 6 : 7, //7 pcmu, 6 pcma
                    channels: 1,
                    sampleRate: 8000,
                    bitDepth: 8
                });

                this.audio_stream_in.on("finish", () => {
                    (process as any).send({
                        action: 'recOff',
                        params: {
                            file: this.in.file
                        }
                    });
                });
                this.rec_start = process.hrtime(); //время старта входящего потока
            }
        }

        if (this.in.rec && this.in.file && this.audio_stream_in) {
            if (!this.audio_stream_in.ending) {
                this.audio_stream_in.write(buffer);
            }
        }
    }

    // ******************** Установка параметров ********************
    private rec(params: any) { 
        for (let key in params) {
            this.in[key] = params[key];
        }
        this.checkCloseStream(params);
    }

    // ******************** Закрыть запись разговора в случае если выставлен флаг ********************    
    private checkCloseStream(params: any) { 
        if (this.rec_type != params.rec) {
            this.rec_type = params.rec;
            if (this.rec_type == false) {
                if (this.audio_stream_in)
                    this.audio_stream_in.end();
                else {
                    (process as any).send({
                        action: 'recOff',
                        params: {},
                        error: 'Record file not found'
                    });
                }
            }
        }
    }

    // ******************** Закрытие входящего исходящего стрима в случае необходимости ********************
    private closeStreams() {
        let f = () => {
            let toDo = () => {
                let data = {
                    action: 'stop'
                };
                (process as any).send(data);
                process.nextTick(process.exit());
            };
            let recFile = this.in.file;

            if (this.fs.existsSync(recFile + '.in') &&
                this.fs.existsSync(recFile + '.out')) {
                    //микшируем записи входящего и исходящего потока
                    // -m: все в один моно файл
                    // -M: стерео файл, левый канал - входящий поток, правый - исходящий 
                let sox = spawn('sox', [this.in.type || '-m', recFile + '.in', recFile + '.out', recFile]);
                sox.on('error', (e: any) => {
                    (process as any).send('SOX on Error pid:' + process.pid + ': ' + e.stack);
                    toDo();
                });
                sox.stdout.on('finish', () => {
                    this.fs.unlinkSync(recFile + '.in');
                    this.fs.unlinkSync(recFile + '.out');
                    toDo();
                });
            } else
                toDo();
        };

        if (this.audio_stream_in) {
            this.audio_stream_in.on("finish", () => {
                if (this.audio_stream_out) {
                    this.audio_stream_out.on("finish", f);
                    this.audio_stream_out.end();
                    this.audio_stream_out.ending = true;
                } else
                    f();
            });
            this.audio_stream_in.end();
        } else
            f();
        
    }
}