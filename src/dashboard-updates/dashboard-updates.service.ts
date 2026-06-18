import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class DashboardUpdatesService {

  private dashboardStats$ = new Subject<any>();

  getUpdatesNotification() {
    return this.dashboardStats$.asObservable();
  }

  sendUpdate(updatedStats: any) {
    this.dashboardStats$.next({ data: updatedStats });
  }
}