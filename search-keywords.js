// Shared vocabulary for geographic variants of a table. Add office feedback here.
// `terms` match titles/subjects unless `variables` is explicitly enabled.
export const concepts=[
  {id:'migration',label:'flyttningar',query:/^(flytt|inflytt|utflytt|nettoflytt|invandr|utvandr)/,terms:['flyttningar'],variables:true},
  {id:'density',label:'befolkningstäthet',query:/^(befolkningstat|tathet)/,terms:['befolkningstathet']},
  {id:'monthly',label:'månadsstatistik',query:/^manads/,terms:['manadsvis']},
  {id:'foreignborn',label:'utrikes födda',query:/^utrikesfodd/,terms:['fodda i sverige eller utlandet','fodelseland']},
  {id:'population',label:'folkmängd',query:/^(befolk|folkm|invan|mannisk|barn|forskolealder)|^person(?:er)?$/,terms:['folkmangd','befolkning'],prefer:/^folkmangd \d/},
  {id:'education',label:'utbildning',query:/^(utbild|skol)/,terms:['utbild','behorig'],prefer:/^hogsta utbild/},
  {id:'income',label:'inkomst',query:/^inkomst/,terms:['inkomst','ekonomisk standard'],prefer:/^forvarvsinkomst/},
  {id:'median',label:'medianinkomst',query:/^median/,terms:['medianinkomst'],variables:true},
  {id:'mean',label:'medelinkomst',query:/^medelinkomst/,terms:['medelinkomst'],variables:true},
  {id:'unemployment',label:'arbetslöshet',query:/^(arbetslos|arbetssok)/,terms:['arbetslos','arbetssok']},
  {id:'employment',label:'sysselsättning',query:/^(syssels|sysels|forvarvsarbet|jobb)/,terms:['syssels','sysels','forvarvsarbet']},
  {id:'labour',label:'arbetsmarknad',query:/^arbetsmark/,terms:['arbetsmarknad']},
  {id:'housing',label:'bostäder',query:/^(bostad|lagenhet)/,terms:['bostad'],prefer:/^bostadsbestand/},
  {id:'construction',label:'nybyggda bostäder',query:/^(nybygg|byggande|fardigstall)/,terms:['nybygg','fardigstall']},
  {id:'households',label:'hushåll',query:/^hushall/,terms:['hushall'],prefer:/^antal hushall/},
  {id:'crowding',label:'trångboddhet',query:/^trangbod/,terms:['trangbod']},
  {id:'forecast',label:'befolkningsprognoser',query:/^(prognos|framtid|befolkningsprognos)/,terms:['prognos']},
  {id:'births',label:'födda',query:/^(nyfodd|fodelse|fodda)/,terms:['fodda efter moderns']},
  {id:'deaths',label:'avlidna',query:/^(avlid|dodsfall|doda)/,terms:['avlidna']},
  {id:'commute',label:'arbetspendling',query:/^(pendl|arbetspendl)/,terms:['arbetspendling']},
  {id:'cars',label:'bilar',query:/^(bil|personbil)/,terms:['personbilar','bilinnehav']},
  {id:'gymnasium',label:'gymnasiebehörighet',query:/^gymnasiebehor/,terms:['gymnasiebehor']},
  {id:'university',label:'högskolebehörighet',query:/^hogskolebehor/,terms:['hogskolebehor']},
  {id:'uvas',label:'unga som varken arbetar eller studerar',query:/^uvas$/,terms:['uvas']},
  {id:'health',label:'ohälsotal',query:/^ohalso/,terms:['ohalsotal']}
];
// Conservative, explicit corrections; never silently reinterpret a different measure.
export const spelling={folkmang:'folkmangd',befolking:'befolkning',utbilding:'utbildning',arbetsloshetet:'arbetsloshet'};
export const phrases=[
  [/\b(?:fodda i utlandet|utrikes fodda)\b/g,'utrikesfodda'],
  [/\bunga som varken arbetar eller studerar\b/g,'uvas'],
  [/\bantal (?:personer|manniskor)\b/g,'personer'],
  [/\bi forskolealdern\b/g,'forskolealder']
];
