export function installPWA(){
 const startMenu=document.querySelector('#stMenu');
 if(startMenu){const link=document.createElement('a');link.className='st-b';link.id='nfxFuzzyCamera';link.href='/showcase/';link.innerHTML='<i>＋</i><span>FUZZY CAMERA<small>Open camera showcase</small></span>';startMenu.prepend(link);}
 if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)return;
 const menu=document.querySelector('#stMenu');if(!menu)return;
 const button=document.createElement('button');button.className='st-b';button.id='nfxInstallApp';button.innerHTML='<i>＋</i><span>INSTALL APP<small>Add Neuroflux to your home screen</small></span>';menu.append(button);
 const note=document.createElement('p');note.id='nfxInstallHelp';note.hidden=true;note.setAttribute('role','status');note.style.cssText='padding:10px 14px;color:#b4d4e4;font-size:12px;line-height:1.5';menu.append(note);
 button.onclick=async()=>{
  const prompt=window.nfxInstallPrompt;
  if(prompt){window.nfxInstallPrompt=null;try{await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted'){button.hidden=true;note.hidden=true;}else{note.textContent='You can install later from your browser menu.';note.hidden=false;}}catch{note.textContent='Use your browser menu to install Neuroflux.';note.hidden=false;}return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  note.textContent=ios?'Tap Share, then Add to Home Screen. If needed, open this page in Safari first.':'Open your browser menu and choose Install app or Add to Home screen.';note.hidden=false;
 };
 window.addEventListener('appinstalled',()=>{button.hidden=true;note.hidden=true;});
}
