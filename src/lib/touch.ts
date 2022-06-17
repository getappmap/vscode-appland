import * as fs from 'fs';

export async function touch(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const time = new Date();
    fs.utimes(path, time, time, (err) => {
      if (err) {
        return fs.open(path, 'w', (err, fd) => {
          if (err) return reject(err);
          fs.close(fd, (err) => (err ? reject(err) : resolve()));
        });
      }
      resolve();
    });
  });
}
