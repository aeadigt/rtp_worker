// ******************** Загрузка зависимостей ********************
import {Socket} from './socket';
import {Player} from './player';
import {Recorder} from './recorder';
import {Dtmf} from './dtmf';

class MediaHandler {
    private socket: any;
    private player: any;
    private recorder: any;
    private dtmf: any;

    constructor() {
        // ******************** Обработка событий текущего процесса ********************
        process.on('disconnect', () => {
            process.exit();
        });

        process.on('uncaughtException', (e) => {
            (process as any).send('uncaughtException pid:' + process.pid + ': stack: ' + e.stack);

            setTimeout(() => {
                process.exit();
            }, 3000);
        });

        process.on('warning', (e: any) => {
            (process as any).send('pid:' + process.pid + ': ' + e + ' \r\n stack: ' + e);
        });


        // ******************** Обработка сообщений родительского процесса ********************
        process.on('message', (data) => {
            if (!data) return;
            // (process as any).send(data.action);

            let params = data.params;
            if (!params) return false;

            switch(data.action) {
                case 'audioBuffer':
                    if (params.sessionID && params.data.length) {
                        this.socket.addAudioBuffer(params);
                    }
                    break;

                case 'rtpInPort':
                    this.createHandlers();
                    this.socket.rtpInPort(params);
                    break;

                case 'init':
                    this.socket.init(params);
                    (process as any).send(data);
                    break;

                case 'close':
                    this.socket.close();
                    break;

                case 'stop_play':
                    this.socket.stopPlay();
                    break;

                case 'start_play':
                    if (params.file || params.audioBuffer) {
                        this.player.startPlay(data);
                    }
                    break;

                case 'rec':
                    (process as any).send(data);
                    this.socket.rec(params);
                    this.recorder.rec(params);
                    break;

                default:
                    break;
            }
        });
    }

    // ******************** Создание и добавление компонентов класса ********************
    createHandlers() {
        // ******************** Создание экземпляров ********************
        this.socket = new Socket();
        this.player = new Player();
        this.recorder = new Recorder();
        this.dtmf = new Dtmf();


        // ******************** Обработчики Плеера ********************
        this.socket.on('writeDataIn', (buffer: Buffer) => {
            this.recorder.emit('writeDataIn', buffer);
        });

        this.socket.on('socketClose', () => {
            this.recorder.emit('socketClose');
        });


        this.socket.on('dtmf', (data: any) => {
            this.dtmf.emit('newDtmf', data);
        });

        this.socket.on('payload', (data: any) => {
            this.dtmf.emit('newPayload', data);
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
    }
}

let mediaHandler = new MediaHandler();