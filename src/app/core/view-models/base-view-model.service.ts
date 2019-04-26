import { ChangeDetectorRef, Injector } from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material';
import { LookupDialogComponent, DialogData } from '../lookup-dialog/lookup-dialog.component';
import { DataService } from '../data.service';
import { BaseModel } from '../models/base.model';

export abstract class BaseViewModel {

  public form: FormGroup;
  public id: string;

  protected dataService: DataService<BaseModel>;
  protected mobileQuery: MediaQueryList;
  protected translate: TranslateService;
  protected formBuilder: FormBuilder;
  protected route: ActivatedRoute;
  protected router: Router;
  protected location: Location;
  protected dialog: MatDialog;

  protected entity: BaseModel;

  private mobileQueryListener: (ev: MediaQueryListEvent) => void;

  public get isMobile(): boolean {
    return this.mobileQuery && this.mobileQuery.matches;
  }

  // abstract get subTitle$(): Observable<string>;

  protected collectionName(): string {
    return this.entity.getModelDescriptor().name;
  }

  constructor(
    private injector: Injector
  ) {
    this.entity = this.createModel();
    this.setUpDeps();

    const changeDetectorRef = this.injector.get(ChangeDetectorRef);
    const media = this.injector.get(MediaMatcher);

    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this.mobileQueryListener = _ => changeDetectorRef.detectChanges();
    this.mobileQuery.addEventListener('change', this.mobileQueryListener);
  }

  public init() {
    this.createForm();
    this.route.params.subscribe(params => {
      const { id } = params;
      if (id && id !== this.id) {
        this.id = id;
        this.loadEntity(id);
      }
    });
  }

  protected createModel(): BaseModel {
    return new BaseModel();
  }

  createForm() {
    const formGroupConfig = this.entity.getModelProperties()
    .reduce((config, propertyName) => {
      const propertyDescriptor = this.entity.getPropertyDescriptor(propertyName);
      const validators = propertyDescriptor && propertyDescriptor.validators || [];
      if (propertyDescriptor && propertyDescriptor.required) {
        validators.push(Validators.required);
      }
      config[propertyName] = [propertyDescriptor && propertyDescriptor.defaultValue, validators];
      return config;
    }, {});
    this.form = this.formBuilder.group(formGroupConfig);
  }

  public save() {
    if (this.id) {
      this.dataService.update(this.id, this.form.value).subscribe(() => null);
      return;
    }
    this.dataService.create(this.form.value)
      .subscribe(
        id => this.location.replaceState(`${this.collectionName}/edit/${id}`)
      );
  }

  public loadEntity(id: string) {
    this.dataService.getById(id).subscribe(entity => {
      this.entity = Object.assign(this.entity, entity);
      this.form.patchValue(entity);
    });
  }

  public dispose() {
    this.mobileQuery.removeEventListener('change', this.mobileQueryListener);
  }

  public openLookup(collectionName: string, formControlName: string, displayedColumns: Array<{ path: string, title: string }>) {
    const dialogRef = this.dialog.open(LookupDialogComponent, {
      width: this.isMobile ? '320px' : '800px',
      data: {
        collectionName,
        displayedColumns
      } as DialogData
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && formControlName) {
        this.form.get(formControlName).setValue(result.name || result.code || result.number || result);
      }
    });
  }

  private setUpDeps() {
    this.dataService = this.injector.get(DataService);
    this.translate = this.injector.get(TranslateService);
    this.formBuilder = this.injector.get(FormBuilder);
    this.route = this.injector.get(ActivatedRoute);
    this.router = this.injector.get(Router);
    this.location = this.injector.get(Location);
    this.dialog = this.injector.get(MatDialog);
  }
}
