import Models from '@appland/models';
import test from 'tape';
import fs from 'fs';
import d3 from 'd3';
import ClassDetails from '../../media/ui/classDetails.js';
import jsdom from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

function readJSON(name) {
  const dir = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(fs.readFileSync(`${dir}/../data/${name}`));
}

const dom = new jsdom.JSDOM(`<div id="classDetails" />`);
global.window = dom.window;
global.d3 = d3;
global.document = window.document;
global.navigator = window.navigator;
global.SVGElement = window.SVGElement;
global.location = window.location;

const petclinicData = readJSON('spring_petclinic.appmap.json');
const petclinic = Models.buildAppMap()
  .source(petclinicData)
  .normalize()
  .build();

function withClassDetails(appmap, test) {
  // TODO: ClassDetails uses its own definition of 'appmap', which precedes the appmap object
  // provided by Models. Reconcile them.
  const classDetails = new ClassDetails(document.querySelector('#classDetails'), { classMap: appmap.classMap, events: appmap.callTree })

  return function(t) {
    test(t, classDetails);
  }
}

test('ClassDetails', withClassDetails(petclinic, (t, classDetails) => {
  const pet = petclinic.classMap.search('org/springframework/samples/petclinic/owner/PetController');
  classDetails.render(pet[0]);

  const functionNames = Array.from(document.querySelectorAll('.functions .function')).map((e) => e.text);
  t.deepEqual(functionNames, [ '#populatePetTypes', '#findOwner', '#initOwnerBinder', '#initPetBinder', '#processCreationForm' ]);
  t.end();
}));

