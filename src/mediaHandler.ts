// ******************** Загрузка зависимостей ********************
import {Socket} from './socket';
import {Player} from './player';
import {Recorder} from './recorder';
import {Dtmf} from './dtmf';
import {Stt} from './stt';
import {EventEmitter} from 'events';

export class MediaHandler extends EventEmitter {
    private socket: Socket;
    private player: Player;
    private recorder: Recorder;
    private dtmf: Dtmf;
    private stt: Stt;

    constructor() {
        super();

        // ********* Обработка событий *********
        this.on('audioBuffer', (data: any) => {
            if (data.params.sessionID && data.params.data.length) {
                this.player.emit('audioBuffer', data.params);
            }
        });

        this.on('rtpInPort', (data: any) => {
            this.createHandlers();
            this.socket.emit('rtpInPort', data.params);
        });

        this.on('init', (data: any) => {
            this.socket.emit('init', data.params);
            // (process as any).send(data);
            this.emit('event', data);
        });

        this.on('close', (data: any) => {
            this.player.emit('stop_flag', true);
            this.socket.emit('close');
        });

        this.on('stop_play', (data: any) => {
            this.player.emit('stop_play');
        });

        this.on('start_play', (data: any) => {
            if (data.params.file || data.params.audioBuffer) {
                this.player.emit('start_play', data);
            }
        });

        this.on('rec', (data: any) => {
            // (process as any).send(data);
            this.emit('event', data);
            this.socket.emit('rec', data.params);
            this.recorder.emit('rec', data.params);
            this.dtmf.emit('rec', data.params);
            this.stt.emit('rec', data.params);
        });
    }

    // ******************** Создание и добавление компонентов класса ********************
    createHandlers() {

        // ******************** Создание экземпляров ********************
        this.socket = new Socket();
        this.player = new Player();
        this.recorder = new Recorder();
        this.dtmf = new Dtmf();
        this.stt = new Stt();

        // ******************** Подписка на проксирующие данные ********************
        let onEvent = (data: any) => {
            if (data) {
                this.emit('event', data);
            }
        }

        this.socket.on('event', onEvent);
        this.player.on('event', onEvent);
        this.recorder.on('event', onEvent);
        this.dtmf.on('event', onEvent);
        this.stt.on('event', onEvent);

        // ******************** Обработчики Сокета ********************
        this.socket.on('writeDataIn', (buffer: Buffer) => {
            this.recorder.emit('writeDataIn', buffer);
        });

        this.socket.on('close', () => {
            this.recorder.emit('close');
        });

        this.socket.on('dtmf', (data: any) => {
            this.dtmf.emit('dtmf', data);
        });

        this.socket.on('payload', (data: Buffer) => {
            this.dtmf.emit('payload', data);
        });

        this.socket.on('stt', (data: Buffer) => {
            this.stt.emit('stt', data);
        });

        // ******************** Обработчики Плеера ********************
        this.player.on('buffer', (buffer: Buffer) => {
            this.socket.emit('addBuffer', buffer);
        });

        this.player.on('startPlayFile', () => {
            this.recorder.emit('startPlayFile');
        });

        this.player.on('writeDataOut', (buffer: Buffer) => {
            this.recorder.emit('writeDataOut', buffer);
        });

        // ******************** Обработчики Recorder ********************
        this.recorder.on('finish', (buffer: Buffer) => {
            process.exit()
        });
    }
}