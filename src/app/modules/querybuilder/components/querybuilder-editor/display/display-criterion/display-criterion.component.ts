import { AttributeFilter } from 'src/app/model/FeasibilityQuery/Criterion/AttributeFilter/AttributeFilter';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Criterion } from 'src/app/model/FeasibilityQuery/Criterion/Criterion';
import { CritGroupPosition } from '../../../../controller/CritGroupArranger';
import { FeatureService } from 'src/app/service/Feature.service';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Query } from 'src/app/model/FeasibilityQuery/Query';
import { Subscription } from 'rxjs';
import { ValueFilter } from 'src/app/model/FeasibilityQuery/Criterion/AttributeFilter/ValueFilter';
import { EditCriterionService } from '../../../../../../service/CriterionService/edit-criterion.service';

@Component({
  selector: 'num-display-criterion',
  templateUrl: './display-criterion.component.html',
  styleUrls: ['./display-criterion.component.scss'],
})
export class DisplayCriterionComponent implements OnInit, OnDestroy {
  @Input()
  criterion: Criterion;

  @Input()
  position: CritGroupPosition;

  @Input()
  showCancelButton: boolean;

  @Output()
  delete = new EventEmitter<Criterion>();

  private subscriptionDialog: Subscription;
  isinvalid: boolean;

  constructor(
    public dialog: MatDialog,
    public featureService: FeatureService,
    private EditService: EditCriterionService
  ) {}

  ngOnInit(): void {
    this.criterion.position = this.position;
    this.isinvalid = this.criterion.isInvalid === true;
  }

  ngOnDestroy(): void {
    this.subscriptionDialog?.unsubscribe();
  }

  newOpenDetailsPopUp(): void {
    if (!this.isinvalid) {
      this.EditService.editCriterion(this.criterion, this.position.critType, this.position);
    }
  }

  doDelete(): void {
    this.delete.emit(this.criterion);
  }

  getValueFilters(): ValueFilter[] {
    if (this.criterion.valueFilters) {
      if (!this.featureService.useFeatureMultipleValueDefinitions()) {
        return this.criterion.valueFilters.length === 0 ? [] : [this.criterion.valueFilters[0]];
      }

      return this.criterion.valueFilters;
    } else {
      return [];
    }
  }

  /**
   * TODO Need to be checked if we should use AbstractAttributeFiltrer
   *
   * @returns
   */
  getAttributeFilters(): AttributeFilter[] {
    if (this.criterion.attributeFilters) {
      if (!this.featureService.useFeatureMultipleValueDefinitions()) {
        return this.criterion.attributeFilters.length === 0
          ? []
          : [this.criterion.attributeFilters[0]];
      }

      return this.criterion.attributeFilters;
    } else {
      return [];
    }
  }
}
