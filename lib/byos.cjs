'use strict';
const categories=[['form','Shapes'],['motion','Motion'],['color','Color'],['fx','Visual FX'],['react','Audio Reactivity'],['cam','Camera'],['input','Audio Input'],['sense','Sensors'],['d3','3D'],['scenes','Scenes'],['ai','AI'],['sys','System'],['recording','Recording']].map(([id,label])=>({id,label}));
function tabs(value=[]){if(!Array.isArray(value)||value.length>categories.length||value.some(id=>!categories.some(c=>c.id===id)))throw Error('Invalid BYOS categories.');return [...new Set(value)];}
module.exports={categories,tabs};
