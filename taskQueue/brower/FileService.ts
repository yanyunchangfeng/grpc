import LogService from 'src/platform/log/browser'
import Service from 'src/base/common/Service'
import { injectable, inject, useService } from 'src/base/common/injector'
import * as fs from 'fs'
import path from 'path'

import child_process from 'child_process'
import { isWin } from 'src/base/common/platform'

@injectable()
export default class FileService extends Service {
  @inject() logService: LogService

  log = this.logService.tag('FileService')
  private _promisefy(method): Function {
    return function(...args): Promise<any> {
      return new Promise((res, rej) => {
        method(...args, (err, data) => {
          if (err) {
            rej(err)
            return
          }
          res(data)
        })
      })
    }
  }

  /**
   *
   * @param filePath contain file path and name
   */
  readFile = async (filePath: string): Promise<string> => {
    this.log.info('readFile', filePath)
    const existing = await this.exists(filePath)
    if (!existing) return ''
    try {
      const content = await this._promisefy(fs.readFile)(filePath, 'utf-8')
      return content
    } catch (e) {
      this.log.error('readFile fail:', e)
    }
  }

  readFileSync = (filePath: string): string => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return content
    } catch (e) {
      this.log.error('readFileSync fail:', e)
      return ''
    }
  }

  writeFile = async (filePath: string, content: string = ''): Promise<void> => {
    this.log.info('writeFile', filePath, content)
    // return this._promisefy(fs.writeFile)(filePath, content)
    const dir = path.dirname(filePath)
    const existing = await this.exists(dir)
    if (!existing) {
      await this.createDir(dir)
    }
    try {
      return fs.writeFileSync(filePath, content, 'utf8')
    } catch (e) {
      this.log.error('writeFile fail:', e)
      throw new Error('文件写入失败，')
    }
  }

  /**
   * 替换的方式写文件内容
   * 介绍：暂时写入 filePath.new, 完成后再替换成 filePath 文件，保证写入过程不会被打断，解决断电程序终止等导致的写入出错问题
   * @param filePath
   * @param content
   * @returns
   */
  writeFileTransactional = async (filePath: string, content: string = ''): Promise<void> => {
    const dir = path.dirname(filePath)
    const existing = await this.exists(dir)
    if (!existing) {
      await this.createDir(dir)
    }
    const tempFile = `${filePath}.new`
    // 先写入临时文件，如果出错，不会影响正常文件
    await this._promisefy(fs.writeFile)(tempFile, content)
    // 写入成功后，替换原来的文件，且.new文件也不会存在
    await this._promisefy(fs.rename)(tempFile, filePath)
  }

  createFile = (filePath: string, content: string = '') => {
    // this.log.info('createFile in ', filePath, 'with content', content)
    return this.writeFile(filePath, content)
  }

  copyFile = async (filePath: string, targetPath: string): Promise<void> => {
    this.log.info('copyFile ', filePath, 'to', targetPath)
    const dir = path.dirname(targetPath)
    const existing = await this.exists(dir)
    if (!existing) {
      await this.createDir(dir)
    }
    return this._promisefy(fs.copyFile)(filePath, targetPath)
  }

  deleteFile = async (filePath: string): Promise<void> => {
    // this.log.info('deleteFile', filePath)

    const existing = await this.exists(filePath)
    if (!existing) {
      this.log.error(`file dose not exist ${filePath}`)
    }

    return this._promisefy(fs.unlink)(filePath)
  }

  createDir = async (filePath: string, recursive = true): Promise<void> => {
    this.log.info('createDir', filePath)
    return this._promisefy(fs.mkdir)(filePath, { recursive })
  }

  async ifFileNotExist(filePath: string, cb: Function) {
    const existing = await this.exists(filePath)
    if (!existing) {
      return cb(filePath)
    }
  }

  copyDir = async (filePath: string, targetPath: string): Promise<{ status: boolean; msg: string }> => {
    this.log.info('copyDir', filePath, 'to', targetPath)

    if (path.dirname(targetPath) === filePath) {
      this.log.error('copyDir', '目标文件夹与源文件夹同路径')
      return {
        status: false,
        msg: '目标文件夹与源文件夹同路径'
      }
    }

    const existing = await this.exists(targetPath)
    if (!existing) {
      await this.createDir(targetPath)
    }

    const files = await this.readDir(filePath)
    await Promise.all(
      files.map(async file => {
        const src = `${filePath}/${file}`
        const dest = `${targetPath}/${file}`
        const isDir = await this.isDir(src)
        if (isDir) {
          await this.copyDir(src, dest)
        } else {
          await this.copyFile(src, dest)
        }
      })
    )
    return {
      status: true,
      msg: '文件夹复制成功'
    }
  }
  /**
   * 拷贝文件夹到指定目录
   * @param {string} filePath 源文件夹路径
   * @param {string} targetPath 目标文件夹路径
   * @param {string} exceptDir 源文件夹中需要排除的文件/文件夹
   * @param {string} conflict 是否覆盖目标文件夹中的同名文件夹
   */
  copyDirExceptDir = async (
    filePath: string,
    targetPath: string,
    exceptDir: string,
    conflict: Boolean
  ): Promise<{ status: boolean; msg: string }> => {
    this.log.info('copyDir', filePath, 'to', targetPath)

    if (path.dirname(targetPath) === filePath) {
      this.log.error('copyDir', '目标文件夹与源文件夹同路径')
      return {
        status: false,
        msg: '目标文件夹与源文件夹同路径'
      }
    }

    if (conflict) {
      await this.deleteDir(targetPath)
    }

    const existing = await this.exists(targetPath)
    if (!existing) {
      await this.createDir(targetPath)
    }

    const files = await this.readDir(filePath)
    await Promise.all(
      files.map(async file => {
        const src = `${filePath}/${file}`
        const dest = `${targetPath}/${file}`
        const isDir = await this.isDir(src)
        if (isDir) {
          let reg = new RegExp(`${exceptDir}$`)
          if (!reg.test(src)) await this.copyDirExceptDir(src, dest, exceptDir, conflict)
        } else {
          await this.copyFile(src, dest)
        }
      })
    )
    return {
      status: true,
      msg: '文件夹复制成功'
    }
  }

  deleteDir = async (filePath: string): Promise<boolean> => {
    let existing = await this.exists(filePath)
    if (!existing) return false

    const isDir = await this.isDir(filePath)
    if (!isDir) {
      this.log.warn(`deleteDir: ${filePath} is not a dir`)
      return false
    }

    try {
      let files = await this.readDir(filePath)

      await Promise.all(
        files.map(async file => {
          const fileFullPath = path.join(filePath, file)
          const isDir = await this.isDir(fileFullPath)
          if (isDir) {
            return this.deleteDir(fileFullPath)
          } else {
            return this.deleteFile(fileFullPath)
          }
        })
      )

      await this._promisefy(fs.rmdir)(filePath)
      return true
    } catch (e) {
      this.log.error('deleteDir fail:', e)
      return false
    }
  }

  exists = (filePath: string): Promise<boolean> => {
    if (!filePath) {
      this.log.error(`exists error: filePath is ${filePath}`)
      return Promise.resolve(false)
    }
    return new Promise((res, rej) => {
      fs.access(filePath, fs.constants.F_OK, err => {
        res(err ? false : true)
      })
    })
  }

  existsSync = (filePath: string): boolean => {
    if (!filePath) {
      this.log.error(`existSync error: ${filePath} is not existed`)
      return false
    }

    return fs.existsSync(filePath)
  }

  readDir = <T extends boolean = false>(
    filePath: string,
    options?:
      | {
          encoding?: BufferEncoding
          withFileTypes?: T
        }
      | BufferEncoding
  ): Promise<T extends false ? string[] : fs.Dirent[]> => {
    return this._promisefy(fs.readdir)(filePath, options)
  }
  rename = (oldPath: string, newPath: string): Promise<string[]> => {
    return this._promisefy(fs.rename)(oldPath, newPath)
  }

  isDir = (filePath: string): Promise<Boolean> => {
    return new Promise((res, rej) => {
      fs.stat(filePath, (err, stats) => {
        if (err) throw err
        res(stats.isDirectory())
      })
    })
  }

  openDir = (filePath: string) => {
    // 仅在windows下可用
    if (isWin) {
      child_process.exec(`start "" "${filePath}"`)
    }
  }

  // access = (filePath: string, mode: number): Promise<boolean> => {
  //   return new Promise(res => {
  //     fs.access(filePath, mode, err => {
  //       res(!err)
  //     })
  //   })
  // }

  fileWriteAccessCheck = async (filePath): Promise<boolean> => {
    try {
      const newfilePath = path.join(filePath, 'sz_fileWriteAccessCheck.txt')
      await this.createFile(newfilePath, '11')
      await this.deleteFile(newfilePath)
      return true
    } catch (e) {
      this.log.error(`fileWriteAccessCheck error: ${e}`)
      return false
    }
  }
  // 移动到 workspaceHandlerService 文件中
  // async isSZRPADir(dirPath): Promise<boolean> {
  //   const results = await Promise.all(
  //     ['res', 'main.sz', 'project.flow', 'szrpa.json'].map(target => {
  //       const targetPath = path.join(dirPath, target)
  //       return this.exists(targetPath).then(res => {
  //         if (!res) this.log.error(`isSZRPADir "${targetPath}" file is not exist`)
  //         return res
  //       })
  //     })
  //   )
  //   return results.every(result => result)
  // }

  async readJSONFile<T>(filePath: string, defaultValue = {}): Promise<T> {
    const content = await this.readFile(filePath)
    return content ? JSON.parse(content) : defaultValue
  }

  // 文件存在的话 路径加1
  async newFilePath(filePath: string) {
    let existPath = await this.exists(filePath)
    if (existPath) {
      let name = path.basename(filePath)
      const reg = /\((\d+)\)$/
      let _name = reg.test(name) ? name.replace(reg, (n, _n) => `(${++_n})`) : `${name}(1)`
      let newPath = path.join(path.dirname(filePath), _name)
      let existNewPath = await this.exists(newPath)
      if (existNewPath) {
        return this.newFilePath(newPath)
      }
      return newPath
    }
    return filePath
  }
}
