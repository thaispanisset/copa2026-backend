import { Test, TestingModule } from '@nestjs/testing';
import { DashboardUpdatesService } from './dashboard-updates.service';

describe('DashboardUpdatesService', () => {
  let service: DashboardUpdatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardUpdatesService],
    }).compile();

    service = module.get<DashboardUpdatesService>(DashboardUpdatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
