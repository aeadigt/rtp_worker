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

// ******************** Загрузка зависимостей ********************
import {MediaHandler} from './mediaHandler';
let mediaHandler = new MediaHandler();

// ******************** Обработка сообщений родительского процесса ********************
process.on('message', (data) => {
    if ( (!data) || (!data.action) || (!data.params) ) {
        return false;
    }

    mediaHandler.emit(data.action, data);
});