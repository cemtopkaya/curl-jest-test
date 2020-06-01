var util = require('util');

var exec = require('child_process').exec;


describe("Filter function", () => {
  test("it should filter by a search term (link)", async (done) => {
    
	var command = 'curl -sL -w "%{http_code}" "http://query7.com" -o /dev/null'
	
	await exec(command, function(error, stdout, stderr){

		console.log('error: ' + error);
		console.log('stdout: ' + stdout+":");
		console.log('stderr: ' + stderr);
		
		expect(stdout).toBe("201");
        done();

	});
  });
});