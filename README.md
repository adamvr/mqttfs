# mqttfsjsbs

A partial implementation of oojah's [very daft idea](https://bitbucket.org/oojah/mqttfs/overview)

See `node mqttfs.js --help` for more info

# Caveats

In the case where a/b/c has been published to and a/b/c/d will be published to,
the first one is there will win. In that case, publishes to a/b/c will be kept
and publishes to a/b/c/d will be discarded.
