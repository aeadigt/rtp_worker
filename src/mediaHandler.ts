// ******************** Загрузка зависимостей ********************
import {Socket} from "./socket"
import {Player} from "./player"
import {Recorder} from "./recorder"

class MediaHandler {
    private socket: any;
    private player: any;
    private recorder: any;

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

            if (data.action === 'audioBuffer' && params.sessionID && params.data.length) {
                this.socket.addAudioBuffer(params);
            }

            if (data.action === 'rtpInPort') {
                this.createHandlers();
                this.socket.rtpInPort(params);
            }

            if (data.action === 'init') {
                this.socket.init(params);
                (process as any).send(data);
            }

            if (data.action === 'close') {
                this.socket.close();
            }

            if (data.action === 'stop_play') {
                this.socket.stopPlay();
            }

            if ( (data.action === 'start_play') && params && (params.file || params.audioBuffer) ) {
                this.player.startPlay(data);
            }

            if (data.action === 'rec' && (params)) {
                (process as any).send(data);
                this.socket.rec(params);
                this.recorder.rec(params);
            }
        });
    }

    // ******************** Создание и добавление компонентов класса ********************
    createHandlers() {
        // ******************** Создание экземпляров ********************
        this.socket = new Socket();
        this.player = new Player();
        this.recorder = new Recorder();


        // ******************** Обработчики Плеера ********************
        this.socket.on('writeDataIn', (buffer: Buffer) => {
            this.recorder.emit('writeDataIn', buffer);
        });

        this.socket.on('socketClose', () => {
            this.recorder.emit('socketClose');
        });


        // ******************** Обработчики Плеера ********************
        this.player.on('buffer', (buffer: Buffer) => {
            this.socket.emit('addBuffer', buffer);
        });

        this.player.on('startPlayFile', () => {
            // (process as any).send('startPlayFile Manager');
            this.recorder.emit('startPlayFile');
        });

        this.player.on('writeDataOut', (buffer: Buffer) => {
            this.recorder.emit('writeDataOut', buffer);
        });
    }
}

let mediaHandler = new MediaHandler();