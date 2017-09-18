import {Rtp} from "./rtpClass"
import {RtpPlayer} from "./rtpPlayer"
import {RtpRecorder} from "./rtpRecorder"

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

let rtp: any;
let player: any;
let recorder: any;

process.on('message', (data) => {
    if (!data) return;

    // (process as any).send(data.action);

    let params = data.params;

    if (data.action === 'audioBuffer' && params.sessionID && params.data.length) {
        rtp.addAudioBuffer(params);
    }

    if (data.action === 'rtpInPort') {

        // ******************** Создание экземпляров ********************
        rtp = new Rtp(data.params.sessionID);
        player = new RtpPlayer(data.params.sessionID);
        recorder = new RtpRecorder(data.params.sessionID);

        // ******************** Обработчики Плеера ********************
        rtp.on('writeDataIn', (buffer: Buffer) => {
            recorder.emit('writeDataIn', buffer);
        });

        rtp.on('socketClose', () => {
            recorder.emit('socketClose');
        });

        // ******************** Обработчики Плеера ********************
        player.on('buffer', (buffer: Buffer) => {
            rtp.emit('addBuffer', buffer);
        });

        player.on('startPlayFile', () => {
            // (process as any).send('startPlayFile Manager');
            recorder.emit('startPlayFile');
        });

        player.on('writeDataOut', (buffer: Buffer) => {
            recorder.emit('writeDataOut', buffer);
        });

        rtp.rtpInPort(params);
    }

    if (data.action === 'init') {
        rtp.init(params);
        (process as any).send(data);
    }

    if (data.action === 'close') {
        rtp.close();
    }

    if (data.action === 'stop_play') {
        rtp.stopPlay();
    }

    if ( (data.action === 'start_play') && params && (params.file || params.audioBuffer) ) {
        player.startPlay(data);
    }

    if (data.action === 'rec' && (params)) {
        (process as any).send(data);
        rtp.rec(params);
        recorder.rec(params);
    }
});