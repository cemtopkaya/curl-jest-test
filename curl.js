class Response {
  constructor() {
    this.Header = null;
    this.Body = null;
  }
}

class Request {
  constructor() {
    this.Header = null;
    this.Body = null;
  }
}

class Curl {
  constructor(_command, _showVerbose, _isVerbose, _isInsecure, _isWithHeader) {
    this.Command = _command || null;
    this.ShowVerbose = _showVerbose || false;
    this.IsVerbose = _isVerbose || false;
    this.IsInsecure = _isInsecure || true;
    this.IsWithHeader = _isWithHeader || false;

    this._init();
  }

  _init() {
    this._stdOut = null;
    this.StdOut = null;
    this.Error = null;
    this.StdErr = null;

    this.Request = null;
    this.Response = null;
  }

  get StdOut() {
    return this._stdOut;
  }

  set StdOut(value) {
    this._stdOut = value;
    if (value) {
      this.getHttpBody();
      this.getHttpStatusCode();
    }
  }

  get Command() {
    return this._command;
  }

  set Command(value) {
    this._init();
    this._command = value;
  }

  toCurlCommand() {
    if (!!this.Command && this.Command.indexOf("curl") != 0) {
      throw new Error("curl komutu yanl??!");
    }

    let args = " ";
    args += this.IsInsecure ? " -k " : "";
    args += this.IsVerbose ? " -v " : "";
    args += this.IsWithHeader ? " -i " : "";
    const newCommand = this.Command + ` ${args}`;

    return newCommand;
  }

  toCurlCommandArray() {
    if (!!this.Command && this.Command.indexOf("curl") != 0) {
      throw new Error("curl komutu yanl??!");
    }

    const parseArgvString = require("string-to-argv");
    let args = parseArgvString(this.Command);
    if (this.IsInsecure) args.push("-k");
    if (this.IsVerbose) args.push("-v");
    if (this.IsWithHeader) args.push("-i");

    if (this.IsVerbose) console.log("toCurlCommandArray() > ", args);
    this.CommandArgs = args;
    return args;
  }

  getHttpStatusCode() {
    if (!this.IsWithHeader) return null;

    let statusCode = null;
    const matches = this.StdOut.match(/(?!^\s+HTTP\/.*?\s)(\d{3})/);

    if (this.StdOut && matches && matches.length > 0) {
      statusCode = matches[0];
    }

    if (statusCode) {
      this.Response = this.Response || {};
      this.Response.StatusCode = parseInt(statusCode);
    }
    return statusCode;
  }

  getHttpBody() {
    let body;
    if (this.StdOut) {
      body = this.StdOut.match(/\r\n\r\n(.*)/)[0].trim();
    }

    if (body) {
      this.Response = this.Response || {};
      this.Response.Body = body;
    }

    return body;
  }

  commandSpawn() {
    let self = this;
    const args = self.toCurlCommandArray();
    let cmd = args.shift();
    const argsString = this.CommandArgs.join(" ");

    return new Promise(async (resolve, reject) => {
      var spawn = require("child_process").spawn;

      /**
       * spawn options için:
       * let options = {detached: false, stdio: [process.stdin, process.stdout, process.stderr]}
       */
      const task = spawn(cmd, args);
      var stdoutChunks = [],
        stderrChunks = [];

      task.stdout.on("data", function (_data) {
        stdoutChunks = stdoutChunks.concat(_data);
        if (self.IsVerbose) {
          console.log(`>>> task.on(data) >\r\n\t data: ${_data.toString()}`);
        }
      });

      task.stdout.on("end", function (_data) {
        if (self.IsVerbose && _data) {
          var stdoutContent = stdoutChunks.toString();
          console.log(
            ">>> task.stdout.on(end) >\r\n\t exec:%s end with this: %s",
            cmd,
            stdoutContent
          );
        }
      });

      task.stderr.on("data", function (_data) {
        stderrChunks.push.apply(stderrChunks, _data);

        if (self.IsVerbose && _data) {
          const result = new Buffer(_data, "utf-8").toString();
          console.log(
            ">>> task.stderr.on(data) >\r\n\t exec:%s error:\n%@",
            cmd,
            result
          );
        }
      });

      task.stderr.on("end", function (_data) {
        // var stderrContent = new Buffer(stderrChunks,"utf-8").toString()
        // this.StdErr = stderrContent;
        // reject(stderrContent)
        // task.kill("SIGINT");
      });

      task.on("error", function (_error) {
        if (self.IsVerbose) {
          console.log(
            ">>> task.on(error) >\r\n\t exec:${argsString} error:\n%@",
            _error
          );
        }
      });

      task.on("uncaughtException", function (_error) {
        if (self.IsVerbose)
          console.log(
            ">>> task.on(uncaughtException) >\r\n\t exec:%s uncaughtException:\n%@",
            argsString,
            _error
          );
      });

      task.on("close", (code, signal) => {
        if (self.IsVerbose) {
          console.log(
            ">>> task.on(close) >\r\n\t task:%s pid:%s terminated due to receipt of signal:%s",
            cmd,
            task.pid,
            signal
          );
        }
      });

      task.on("exit", function (code) {
        if (code == 0) {
          var stdoutContent = stdoutChunks.toString();
          self.StdOut = stdoutContent;

          resolve(stdoutContent);
        } else {
          var error = new Error();
          error.description = this.Command;
          error.code = code;
          if (self.IsVerbose) {
            console.log(
              ">>> task.on(exit) >\r\n\t pid:%d Error:\n%@",
              task.pid,
              error
            );
          }

          var stderrContent = new Buffer(stderrChunks, "utf-8").toString();
          this.StdErr = stderrContent;
          reject(stderrContent);
        }
        // at exit explicitly kill exited task
        // task.kill("SIGINT");
      });

    });
  }

  commandExec() {
    return new Promise((resolve, reject) => {
      const exec = require("child_process").exec;

      const cmd = self.toCurlCommand();

      let child = exec(cmd, function (_error, _stdout, _stderr) {
        self.StdOut = _stdout;
        self.Error = _error;
        self.StdErr = _stderr;

        if (self.ShowVerbose) {
          console.log(`STDOUT >  ${_stdout} <`);
          console.log(`ERROR >  ${_error} <`);
          console.log(`STDERR > ${_stderr} <`);
        }

        if (_error) {
          const hata = `------------------------------
        \tKomut:\t ${cmd}
        \tHata:\t${_error.stack}
        \tHata Kodu:\t${_error.code}
        \tHata Sinyali:\t${_error.signal}
        \tStdError:\t${_stderr}\r\n--------------------`;
          console.log(hata);
          reject(_error);
        } else {
          resolve(_stdout);
        }
      });

      child.on("exit", (code) => {
        console.log(`Proc exited with code ${code}`);
        reject(code);
      });
    });
  }

  execute() {
    let self = this;
    return new Promise((resolve, reject) => {});
  }
}

module.exports = { Curl, Response, Request };
