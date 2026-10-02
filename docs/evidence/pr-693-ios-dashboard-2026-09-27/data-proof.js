(async()=>{
 const mods=__r.getModules();const mod=(p)=>__r([...mods].find(([id,m])=>p.test(m.verboseName??''))[0]);
 const clerk=mod(/@clerk\/expo\/dist\/index.js$/).getClerkInstance();
 const {ConvexHttpClient}=mod(/convex\/dist\/cjs\/browser\/http_client.js$/);
 const {env}=mod(/src\/lib\/runtime-config.ts$/);
 const api=mod(/^convex\/_generated\/api.js$/).api;
 const dayKeys=mod(/src\/features\/dashboard\/dashboard-agenda.ts$/).getDashboardRelevantDayKeys({selectedDayKey:'2026-09-27',todayKey:'2026-09-27'});
 const c=new ConvexHttpClient(env.EXPO_PUBLIC_CONVEX_URL);c.setAuth(await clerk.session.getToken({template:'convex'}));
 const [entries,plans]=await Promise.all([c.query(api.dayEntries.listByDayKeys,{dayKeys}),c.query(api.learningPlans.listOverview,{})]);
 return {userId:clerk.user.id,selectedDay:'2026-09-27',dayKeys,entries,plans};
})()
