import { Test, TestingModule } from '@nestjs/testing';
import { DashboardUpdatesController } from './dashboard-updates.controller';

describe('DashboardUpdatesController', () => {
  let controller: DashboardUpdatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardUpdatesController],
    }).compile();

    controller = module.get<DashboardUpdatesController>(DashboardUpdatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
