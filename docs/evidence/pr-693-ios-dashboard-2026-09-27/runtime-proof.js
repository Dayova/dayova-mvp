(()=>{
 const mods=__r.getModules();
 const find=(pattern)=>[...mods].find(([id,m])=>pattern.test(m.verboseName??''));
 const names=(pattern)=>[...mods].filter(([id,m])=>pattern.test(m.verboseName??'')).map(([id,m])=>({id,name:m.verboseName,initialized:m.isInitialized,dependencies:Array.from(m.dependencyMap??[]).map(i=>mods.get(i)?.verboseName??i)}));
 const source=find(/NativeSourceCode\.js$/);let sourceCode;
 try{const s=__r(source[0]).default;sourceCode=s.getConstants();}catch(e){sourceCode={error:String(e)}}
 const v=find(/ReactNativeVersion\.js$/);let version;
 try{version=__r(v[0]).version}catch(e){version=String(e)}
 return {sourceCode,reactNativeVersion:version,modules:names(/src\/(components\/(create-entry-button|ui\/add-icon)|features\/dashboard\/dashboard-screen)\.tsx$/)};
})()
