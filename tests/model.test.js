const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../model.js');

test('exercise identity normalizes case, accents and whitespace without fuzzy matching',()=>{
  assert.equal(model.exerciseKey('  Peso   MUERTO RUMANO '),model.exerciseKey('peso muerto rumano'));
  assert.equal(model.exerciseKey('press de banca'),model.exerciseKey('PRESS DE BÁNCA'));
  assert.notEqual(model.exerciseKey('press de banca inclinado'),model.exerciseKey('press de banca'));
});

test('weight-only sync preserves reps and different set counts',()=>{
  const source={syncId:'rdl',syncMode:'weight',sets:[{weight:'30',reps:'8'},{weight:'30',reps:'7'}]};
  const target={syncId:'rdl',sets:[{weight:'20',reps:'12'},{weight:'20',reps:'12'},{weight:'20',reps:'10'}]};
  const updated=model.syncExercisePlan(source,[{exercises:[source,target]}]);
  assert.equal(updated,2);
  assert.deepEqual(target.sets.map(s=>[s.weight,s.reps]),[['30','12'],['30','12'],['20','10']]);
  assert.equal(target.sets.length,3);
});

test('weight and reps sync updates matching rows but never resizes a linked routine',()=>{
  const source={syncId:'rdl',syncMode:'weight-reps',sets:[{weight:'40',reps:'6'},{weight:'40',reps:'6'}]};
  const target={syncId:'rdl',sets:[{weight:'20',reps:'12'},{weight:'20',reps:'12'},{weight:'20',reps:'10'}]};
  model.syncExercisePlan(source,[{exercises:[source,target]}]);
  assert.deepEqual(target.sets.map(s=>[s.weight,s.reps]),[['40','6'],['40','6'],['20','10']]);
  assert.equal(target.sets.length,3);
});

test('independent exercises and different IDs do not sync',()=>{
  const source={syncId:'one',syncMode:'independent',sets:[{weight:'50',reps:'5'}]};
  const independent={syncId:'one',sets:[{weight:'20',reps:'12'}]};
  const other={syncId:'two',sets:[{weight:'10',reps:'10'}]};
  assert.equal(model.syncExercisePlan(source,[{exercises:[source,independent,other]}]),0);
  assert.deepEqual(independent.sets[0],{weight:'20',reps:'12'});
  assert.deepEqual(other.sets[0],{weight:'10',reps:'10'});
});

test('volume includes only completed sets with positive weight and reps',()=>{
  const workout={exercises:[{sets:[
    {done:true,weight:'30',reps:'8'},
    {done:false,weight:'100',reps:'10'},
    {done:true,weight:'0',reps:'12'},
    {done:true,weight:'25',reps:'0'}
  ]}]};
  assert.equal(model.completedVolume(workout),240);
});


test('completed heavier weights propagate to every linked routine without lowering other targets',()=>{
  const monday={syncId:'lateral-raise',syncMode:'weight',sets:[{weight:'8',reps:'15'},{weight:'8',reps:'12'}]};
  const friday={syncId:'lateral-raise',syncMode:'weight',sets:[{weight:'7',reps:'20'},{weight:'9',reps:'12'}]};
  const other={syncId:'row',syncMode:'weight',sets:[{weight:'40',reps:'10'}]};
  const routines=[{exercises:[monday]},{exercises:[friday,other]}];
  const source={...monday,sets:[{weight:'10',reps:'12',done:true},{weight:'8',reps:'12',done:false}]};
  assert.equal(model.syncProgressWeights(source,routines),2);
  assert.deepEqual(friday.sets.map(s=>s.weight),['10','9']);
  assert.deepEqual(monday.sets.map(s=>s.weight),['10','8']);
  assert.equal(other.sets[0].weight,'40');
});

test('progress weight synchronization ignores incomplete, zero and independent sets',()=>{
  const target={syncId:'same',syncMode:'weight',sets:[{weight:'20',reps:'10'}]};
  const independent={syncId:'solo',syncMode:'independent',sets:[{weight:'5',reps:'10'}]};
  assert.equal(model.syncProgressWeights({syncId:'same',sets:[{weight:'30',done:false}]},[{exercises:[target]}]),0);
  assert.equal(model.syncProgressWeights({syncId:'same',sets:[{weight:'0',done:true}]},[{exercises:[target]}]),0);
  assert.equal(model.syncProgressWeights(independent,[{exercises:[independent]}]),0);
  assert.equal(target.sets[0].weight,'20');
});
