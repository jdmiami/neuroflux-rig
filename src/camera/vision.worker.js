import {FilesetResolver,ImageSegmenter,FaceLandmarker,PoseLandmarker} from '@mediapipe/tasks-vision';
const urls={segment:'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',face:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',pose:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'};
const models={};let vision;
async function model(kind){
 if(models[kind])return models[kind];
 postMessage({type:'status',kind,message:'Downloading/loading '+kind+' model…'});
 vision??=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');
 const cache=await caches.open('nfx-vision-models-v1');let response=await cache.match(urls[kind]);
 if(!response){response=await fetch(urls[kind]);if(!response.ok)throw Error('Model download failed. Check your connection.');await cache.put(urls[kind],response.clone());}
 const modelAssetBuffer=new Uint8Array(await response.arrayBuffer());
 const baseOptions={modelAssetBuffer,delegate:'CPU'};
 models[kind]=kind==='segment'?await ImageSegmenter.createFromOptions(vision,{baseOptions,runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false}):kind==='face'?await FaceLandmarker.createFromOptions(vision,{baseOptions,runningMode:'VIDEO',numFaces:2}):await PoseLandmarker.createFromOptions(vision,{baseOptions,runningMode:'VIDEO',numPoses:1});
 postMessage({type:'status',kind,message:kind+' model ready'});return models[kind];
}
onmessage=async({data})=>{
 if(data.type==='release'){for(const m of Object.values(models))m.close();close();return;}
 const {kind,bitmap,stamp}=data;
 try{const m=await model(kind);let out;
  if(kind==='segment')m.segmentForVideo(bitmap,stamp,result=>{const mask=result.categoryMask;out={mask:new Uint8Array(mask.getAsUint8Array()),width:mask.width,height:mask.height};});
  else if(kind==='face')out={faces:m.detectForVideo(bitmap,stamp).faceLandmarks};
  else out={poses:m.detectForVideo(bitmap,stamp).landmarks};
  postMessage({type:'result',kind,...out},out.mask?[out.mask.buffer]:[]);
 }catch(error){postMessage({type:'error',kind,message:String(error.message||error).slice(0,180)});}
 finally{bitmap?.close();postMessage({type:'idle'});}
};
