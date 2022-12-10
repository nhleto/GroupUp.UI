import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { map, takeUntil, tap } from 'rxjs';
import { AuthService } from '../Services/auth.service';
import { Destroyable } from './destroyable';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable()
export abstract class Utility extends Destroyable {
  constructor(protected router: Router, protected angularFireAuth: AngularFireAuth) {
    super();

    this.angularFireAuth.authState
      .pipe(
        map((token) => !!token),
        tap(data => console.log('in the utility class', data)),
        takeUntil(this.destroy$)
      )
      .subscribe((isSignedIn) => {
        if (!isSignedIn) {
          this.router.navigate(['index']);
        }
      });
  }
}