const mega = require('megajs');

var auth = {
    email: 'ironmanhax@onlyfans.com',
    password: 'cola',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

//no idea tf this shit does so going with the flow
var upload = function(data, name) {
    return new Promise(function(resolve, reject) {
        try {
            var storage = new mega.Storage(auth, function() {
                data.pipe(storage.upload({ name: name, allowUploadBuffering: true }));
                storage.on("add", function(file) {
                    file.link(function(err, url) {
                        if (err) {
                            storage.close();
                            reject(err);
                        } else {
                            storage.close();
                            resolve(url);
                        }
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { upload };
