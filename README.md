# Page MOD Loader v3

javascript & css MOD loader from your local file, use any toolchain for MOD develop

## Getting Start

### 1. create root folder for your MODs

File system access API can't read folder from driver root , so make sure you don't put folder there.

### 2. create a MOD

create a sub folder inside your root folder for your new MOD, and create `config.json` , for example if your root folder at `C:\Users\xxx\OneDrive\WebMODs`
your folder structure should look like following:
```
WebMODs
 └ superCoolMod
    └ config.json
```
### 3. add js or/and css files

you can excute as many scrips or add styles as you need , that's say you need a `index.js` and a `index.css` , just put files in your mod folder like:
```
WebMODs
 └ superCoolMod
    ├ index.js
    ├ index.css
    └ config.json
```

### 4. setup config.json

open `config.json` , the  schema in the config should like following:
```json
{
    "match":"https://xxx.net/*",
    "inject": [
        {
            "path": "index.js",
            "type": "script"
        },
        {
            "path": "index.css",
            "type": "style"
        }
    ]
}
```
the `match` field can be string or array, for the match syntax , please see : [Match patterns(google dev)](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
the script and style will inject(excute) to page sames as the order you put in the `inject` array

### 5. load MODs

click on extension icon , click `Option` , click `Select Mod Folder` and select your root folder , browser will ask permission to read the folder
you need do this everytime you made changes of your MODs

### 6. tips

you can put any files (like Typescript source code) in the folder , the extension only read files you set in the `config.json`

the `path` in `inject` setting can use nested path like `dist/main/abc.js`

I have created a project template and basic file scaffolding script in [here]('mod-template')

