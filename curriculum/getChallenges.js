const path = require('path');
const { findIndex } = require('lodash');
const readDirP = require('readdirp-walk');
const { parseMarkdown } = require('@freecodecamp/challenge-md-parser');

const { dasherize } = require('./utils');
const { locale } = require('../config/env.json');

const challengesDir = path.resolve(__dirname, './challenges');
const localeChallengesRootDir = path.resolve(challengesDir, `./${locale}`);
const metaDir = path.resolve(challengesDir, '_meta');
exports.challengesDir = challengesDir;
exports.localeChallengesRootDir = localeChallengesRootDir;
exports.metaDir = metaDir;

exports.getChallengesForLang = function getChallengesForLang(lang) {
  let curriculum = {};
  return new Promise(resolve =>
    readDirP({ root: path.resolve(challengesDir, `./${lang}`) })
      .on('data', file => buildCurriculum(file, curriculum))
      .on('end', () => resolve(curriculum))
  );
};

async function buildCurriculum(file, curriculum) {
  const { name, depth, path: filePath, stat } = file;
  if (depth === 1 && stat.isDirectory()) {
    // extract the superBlock info
    const { order, name: superBlock } = superBlockInfo(name);
    curriculum[superBlock] = { superBlock, order, blocks: {} };
    return;
  }
  if (depth === 2 && stat.isDirectory()) {
    const blockName = getBlockNameFromPath(filePath);
    const metaPath = path.resolve(
      __dirname,
      `./challenges/_meta/${blockName}/meta.json`
    );
    const blockMeta = require(metaPath);
    const { name: superBlock } = superBlockInfoFromPath(filePath);
    const blockInfo = { meta: blockMeta, challenges: [] };
    curriculum[superBlock].blocks[name] = blockInfo;
    return;
  }
  if (name === 'meta.json' || name === '.DS_Store') {
    return;
  }

  const block = getBlockNameFromPath(filePath);
  const { name: superBlock } = superBlockInfoFromPath(filePath);
  let challengeBlock;
  try {
    challengeBlock = curriculum[superBlock].blocks[block];
  } catch (e) {
    console.log(superBlock, block);
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }
  const { meta } = challengeBlock;

  const challenge = await createChallenge(filePath, meta);

  challengeBlock.challenges = [...challengeBlock.challenges, challenge];
}

async function createChallenge(challengeFilePath, maybeMeta) {
  const fullPath = path.resolve(localeChallengesRootDir, challengeFilePath);
  const metaPath = path.resolve(
    metaDir,
    `./${getBlockNameFromFullPath(fullPath)}/meta.json`
  );
  let meta;
  if (maybeMeta) {
    meta = maybeMeta;
  } else {
    meta = require(metaPath);
  }
  const { name: superBlock } = superBlockInfoFromPath(challengeFilePath);
  const challenge = await parseMarkdown(fullPath);
  const challengeOrder = findIndex(
    meta.challengeOrder,
    ([id]) => id === challenge.id
  );
  const { name: blockName, order, superOrder } = meta;
  challenge.block = blockName;
  challenge.dashedName = dasherize(challenge.title);
  challenge.order = order;
  challenge.superOrder = superOrder;
  challenge.superBlock = superBlock;
  challenge.challengeOrder = challengeOrder;

  return challenge;
}

exports.createChallenge = createChallenge;

function superBlockInfoFromPath(filePath) {
  const [maybeSuper] = filePath.split(path.sep);
  return superBlockInfo(maybeSuper);
}

function superBlockInfo(fileName) {
  const [maybeOrder, ...superBlock] = fileName.split('-');
  let order = parseInt(maybeOrder, 10);
  if (isNaN(order)) {
    return { order: 0, name: fileName };
  } else {
    return {
      order: order,
      name: superBlock.join('-')
    };
  }
}

function getBlockNameFromPath(filePath) {
  const [, block] = filePath.split(path.sep);
  return block;
}

function getBlockNameFromFullPath(fullFilePath) {
  const [, block] = fullFilePath.split(path.sep).reverse();
  return block;
}
