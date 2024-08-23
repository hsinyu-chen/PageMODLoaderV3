# Page MOD Loader v3 MOD template
with scss and typescript

template project for MODs

## Getting Start

clone this folder

and run `.\create.ps1 -Name [your MOD name]` to create a MOD under MODs folder

edit `config.json` in created folder (change match field as you needed)

run `npm i` in created folder

write your code, I have added a simple tsx dom renderer into it
so you can use 
```tsx
const element = <div>hello</div>;
```
to create element , no need to use document.createElement like
```js
const element = document.createElement('div')
element.textContent = 'hello'
```

after MOD developed , select folder `MODs` in extension option page to upload MODs
