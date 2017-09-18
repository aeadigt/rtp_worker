// ******************** Загрузка зависимостей ********************
import {Socket} from "./socket"
import {Player} from "./player"
import {Recorder} from "./recorder"


// ******************** Глобавльные переменные ********************
let socket: any;
let player: any;
let recorder: any;


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
        socket.addAudioBuffer(params);
    }

    if (data.action === 'rtpInPort') {
        createHandlers(data);
        socket.rtpInPort(params);
    }

    if (data.action === 'init') {
        socket.init(params);
        (process as any).send(data);
    }

    if (data.action === 'close') {
        socket.close();
    }

    if (data.action === 'stop_play') {
        socket.stopPlay();
    }

    if ( (data.action === 'start_play') && params && (params.file || params.audioBuffer) ) {
        player.startPlay(data);
    }

    if (data.action === 'rec' && (params)) {
        (process as any).send(data);
        socket.rec(params);
        recorder.rec(params);
    }
});


// ******************** Создание и навешивание обработчиков ********************

function createHandlers(data: any) {
    // ******************** Создание экземпляров ********************
    socket = new Socket(data.params.sessionID);
    player = new Player(data.params.sessionID);
    recorder = new Recorder(data.params.sessionID);


    // ******************** Обработчики Плеера ********************
    socket.on('writeDataIn', (buffer: Buffer) => {
        recorder.emit('writeDataIn', buffer);
    });

    socket.on('socketClose', () => {
        recorder.emit('socketClose');
    });


    // ******************** Обработчики Плеера ********************
    player.on('buffer', (buffer: Buffer) => {
        socket.emit('addBuffer', buffer);
    });

    player.on('startPlayFile', () => {
        // (process as any).send('startPlayFile Manager');
        recorder.emit('startPlayFile');
    });

    player.on('writeDataOut', (buffer: Buffer) => {
        recorder.emit('writeDataOut', buffer);
    });
}