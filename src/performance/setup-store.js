export class SetupStore {
 async db(){if(this.database)return this.database;this.database=await new Promise((resolve,reject)=>{const request=indexedDB.open('neuroflux-setups',1);request.onupgradeneeded=()=>request.result.createObjectStore('setups',{keyPath:'name'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return this.database;}
 async run(mode,fn){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('setups',mode),request=fn(tx.objectStore('setups'));let value;request.onsuccess=()=>value=request.result;tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(request.error||tx.error);tx.onabort=()=>reject(request.error||tx.error);});}
 list(){return this.run('readonly',s=>s.getAll());}save(setup){return this.run('readwrite',s=>s.put(setup));}create(setup){return this.run('readwrite',s=>s.add(setup));}remove(name){return this.run('readwrite',s=>s.delete(name));}
}
