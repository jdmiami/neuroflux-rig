export class MotionController {
 constructor(){this.settings={silenceStop:true,threshold:-48,hysteresis:6,hold:300};this.simPlaying=false;this.held=true;this.clock=0;this.quiet=0;this.loud=0;this.status='WAITING FOR SOUND';try{const s=JSON.parse(localStorage.getItem('nfx.motion.v1'));if(s){this.settings.threshold=s.threshold??-48;this.settings.hold=s.hold??300;}}catch{} }
 configure(p){for(const [key,value] of Object.entries(p)){if(key==='silenceStop'&&typeof value==='boolean'||key==='threshold'&&Number.isFinite(value)&&value>=-80&&value<=-12||key==='hold'&&Number.isFinite(value)&&value>=0&&value<=2000)this.settings[key]=value;else throw Error('Unsupported motion setting.');}try{localStorage.setItem('nfx.motion.v1',JSON.stringify(this.settings));}catch{}return this.settings;}
 update({dt,source,playing,rms,volume=1,manualFreeze=false}){
 const ms=dt*1000,db=20*Math.log10(Math.max(rms||0,1e-8));
 const explicit=source==='sim'? !this.simPlaying:!playing||volume<=.0001;
 if(manualFreeze||explicit){this.held=true;this.quiet=0;this.loud=0;}
 else if(!this.settings.silenceStop||source==='sim'){this.held=false;this.quiet=0;}
 else if(this.held){this.loud=db>this.settings.threshold+this.settings.hysteresis?this.loud+ms:0;if(this.loud>=45){this.held=false;this.quiet=0;}}
 else{this.quiet=db<this.settings.threshold?this.quiet+ms:0;if(this.quiet>=this.settings.hold)this.held=true;}
 // Disabling Silence Stop allows autonomous animation, but an explicitly paused simulation stays paused.
 if(!manualFreeze&&!this.settings.silenceStop&&source!=='sim')this.held=false;
 if(!this.held)this.clock+=dt;
 this.status=manualFreeze?'MOTION PAUSED':source==='sim'?(this.simPlaying?'SIMULATION RUNNING':'SIMULATION PAUSED'):this.held?'WAITING FOR SOUND':'FOLLOWING AUDIO';
 return this.held?0:dt;
 }
}
