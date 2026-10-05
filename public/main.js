
var Paperclips = {};

Paperclips.game = new GameLoop();
Paperclips.ViewManager = new ViewManager();
Paperclips.PluginManager = new PluginManager();

// If there is save data then load it
if (hasExistingSave()) {
  load();

  if(hasPresige()) {
    loadPrestige();
    refresh();
  }
}

Paperclips.game.onSlow([
  adjustWirePrice,
  manageProjects,
  withHumans(chain([
    salesCalculator,
    throttle(10, chain([
      calculateRev,
      stockShop
    ])),
    withStock(throttle(25, chain([
      atRandom(sellStock, 0.3),
      updateStocks
    ]))),
  ])),
  throttle(250, save)
]);

Paperclips.game.onFast([
  incrementTicks,
  milestoneCheck,
  withComputer(calculateOperations),
  withHumans(chain([
    calculateTrust,
    demandCurve,
    withWireBuyerOn(when(() => wire <= 1, buyWire))
  ])),
  withQuantumComputer(quantumCompute),
  incrementClipRateTracker,
  updateClipRate,
  withInvestmentEngine(throttle(10000, reportInvestmentRevenue)),
  withProbes(exploreUniverse),
  withoutHumans(chain([
    onEarth(updateDroneButtons),
    updatePower,
    updateSwarm,
    acquireMatter,
    processMatter,
    calculateFactoryClips
  ])),
  inSpace(chain([
    withoutProbes(() => probeCount = 0),
    encounterHazards,
    spawnFactories,
    spawnHarvesters,
    spawnWireDrones,
    spawnProbes,
    drift,
    war
  ])),
  autoClipper,
  withCreativity(calculateCreativity)
]);

Paperclips.game.onRender([
  renderStockList,
  buttonUpdate,
  updateStats,
  dismantleLevel(1, chain([
    hideElement(probeDesignDivElement),
    endTimerLevel(1, 50, hideElement(increaseProbeTrustDivElement)),
    endTimerLevel(1, 100, hideElement(increaseMaxTrustDivElement)),
    endTimerLevel(1, 150, hideElement(spaceDivElement)),
    endTimerLevel(1, 175, hideElement(battleCanvasDivElement)),
    endTimerLevel(1, 190, hideElement(honorDivElement))
  ])),
  dismantleLevel(2, chain([
    hideElement(wireProductionDivElement),
    showElement(wireTransDivElement),
    endTimerLevel(2, 50, hideElement(swarmGiftDivElement)),
    endTimerLevel(2, 100, hideElement(swarmEngineElement)),
    endTimerLevel(2, 150, hideElement(swarmSliderDivElement))
  ])),
  dismantleLevel(3, chain([
    hideElement(factoryDivSpaceElement),
    hideElement(clipsPerSecDivElement),
    hideElement(tothDivElement)
  ])),
  dismantleLevel(4, chain([
    hideElement(strategyEngineElement),
    hideElement(tournamentManagementElement)
  ])),
  dismantleLevel(5, chain([
    hideElement(btnQcomputeElement),
    dimQuantumChips,
    renderElement(transWireElement, () => formatWithCommas(wire)),
    endTimerLevel(4, 10, hideElement(qChipsElements[9])),
    endTimerLevel(4, 60, hideElement(qChipsElements[8])),
    endTimerLevel(4, 100, hideElement(qChipsElements[7])),
    endTimerLevel(4, 130, hideElement(qChipsElements[6])),
    endTimerLevel(4, 150, hideElement(qChipsElements[5])),
    endTimerLevel(4, 160, hideElement(qChipsElements[4])),
    endTimerLevel(4, 165, hideElement(qChipsElements[3])),
    endTimerLevel(4, 169, hideElement(qChipsElements[2])),
    endTimerLevel(4, 172, hideElement(qChipsElements[1])),
    endTimerLevel(4, 174, hideElement(qChipsElements[0])),
    endTimerLevel(4, 250, hideElement(qComputingElement))
  ])),
  dismantleLevel(6, hideElement(processorDisplayElement)),
  dismantleLevel(7, chain([
    hideElement(compDivElement),
    hideElement(projectsDivElement)
  ])),
  endTimerLevel(6, 250, hideElement(creationDivElement))
]);

Paperclips.game.onEvents([
  updateInvestmentValues,
  synchroniseStratPicker,
  updateGameFlags,
  updateAutoTourney,
  dismantleLevel(5, chain(
    [10, 60, 100, 130, 150, 160, 165, 169, 172, 174].map(time =>
      endTimerIs(4, time, incrementWire))
  )),
  whenProjectComplete(project148, incrementEndTimer(1)),
  whenProjectComplete(project211, incrementEndTimer(2)),
  whenProjectComplete(project212, incrementEndTimer(3)),
  whenProjectComplete(project213, incrementEndTimer(4)),
  whenProjectComplete(project215, incrementEndTimer(5)),
  whenProjectComplete(project216, when(() => wire == 0, incrementEndTimer(6))),
  endTimerLevel(6, 500, milestoneIs(15, chain([
    playThrenody,
    () => displayMessage("宇宙回形针"),
    incrementMilestone
  ]))),
  endTimerLevel(6, 600, milestoneIs(16, chain([
    () => displayMessage("弗兰克·兰茨制作"),
    incrementMilestone
  ]))),
  endTimerLevel(6, 700, milestoneIs(17, chain([
    () => displayMessage("贝内特·福迪负责战斗程序"),
    incrementMilestone
  ]))),
  endTimerLevel(6, 800, milestoneIs(18, chain([
    () => displayMessage("《河之歌》由通托的扩展头带乐队创作，经马尔科姆·塞西尔许可使用"),
    incrementMilestone
  ]))),
  endTimerLevel(6, 800, milestoneIs(18, chain([
    () => displayMessage("© 2017 人人屋游戏"),
    incrementMilestone
  ])))
]);

var combatLoop = new Loop({ speed: 16 });
combatLoop.add(app.update);
Paperclips.game.register('combat', combatLoop);

Paperclips.game.start();
