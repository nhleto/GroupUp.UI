import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './Screens/home/home.component';
import { PageNotFoundComponent } from './Components/page-not-found/page-not-found.component';
import { GroupCreationComponent } from './Components/group-creation/group-creation.component';
import { GroupDisplayComponent } from './Components/group-display/group-display.component';
import { RouteGuardService as RouteGuard } from './Security/route-guard.service';
import { UserPageComponent } from './Screens/user-page/user-page.component';

const ROUTES: Routes = [
  {
    path: 'group/:id',
    component: GroupDisplayComponent,
    canActivate: [RouteGuard],
  },
  {
    path: 'group',
    component: GroupCreationComponent,
    canActivate: [RouteGuard],
  },
  {
    path: 'user',
    component: UserPageComponent,
    canActivate: [RouteGuard],
  },
  { path: '', redirectTo: '/index', pathMatch: 'full' },
  { path: 'index', component: HomeComponent },
  { path: 'not-found', component: PageNotFoundComponent },
  { path: '**', redirectTo: '/not-found', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(ROUTES)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
