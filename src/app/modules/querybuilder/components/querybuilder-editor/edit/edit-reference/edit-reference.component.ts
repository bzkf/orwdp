import { AttributeFilter } from 'src/app/model/FeasibilityQuery/Criterion/AttributeFilter/AttributeFilter';
import { Component, Input, OnInit } from '@angular/core';
import { CreateCriterionService } from 'src/app/service/CriterionService/CreateCriterion.service';
import { Criterion } from 'src/app/model/FeasibilityQuery/Criterion/Criterion';
import { FilterTypes } from 'src/app/model/FilterTypes';
import { Query } from 'src/app/model/FeasibilityQuery/Query';
import { QueryProviderService } from 'src/app/modules/querybuilder/service/query-provider.service';
import { TerminologyCode } from 'src/app/model/terminology/Terminology';
import { TimeRestriction } from 'src/app/model/FeasibilityQuery/TimeRestriction';
import { CritGroupArranger } from 'src/app/modules/querybuilder/controller/CritGroupArranger';
import { QueryService } from 'src/app/service/QueryService.service';

@Component({
  selector: 'num-edit-reference',
  templateUrl: './edit-reference.component.html',
  styleUrls: ['./edit-reference.component.scss'],
})
export class EditReferenceComponent implements OnInit {
  @Input()
  referenceAttributes: Array<AttributeFilter> = [];

  @Input()
  criterion: Criterion;

  @Input()
  query: Query;

  @Input()
  preExistingReferenceCriterions: Array<Criterion> = [];

  referenceChecked = false;

  referenceCriterionsList: Array<Criterion> = [];

  constructor(
    private createCriterionService: CreateCriterionService,
    public queryService: QueryService
  ) {}

  ngOnInit() {
    this.referenceChecked = this.criterion.linkedCriteria.length > 0 ? true : false;
    this.createCriterionFromSingleReference();
  }

  selectCheckboxForReference(singleReferenceCriterion: Criterion) {
    if (!singleReferenceCriterion.isLinked) {
      this.setReference(singleReferenceCriterion);
    } else {
      this.deleteLinkedCriterion(singleReferenceCriterion);
    }
  }

  compareToLinkedCriteria() {
    this.criterion.linkedCriteria.forEach((criteria) => {
      const existingIndex = this.referenceCriterionsList.findIndex(
        (item) => item.criterionHash === criteria.criterionHash
      );
      if (existingIndex !== -1) {
        // If the criterion already exists in referenceCriterionsList, replace it
        this.referenceCriterionsList[existingIndex] = criteria;
      } else {
        // If the criterion doesn't exist, add it to the list
        this.referenceCriterionsList.push(criteria);
      }
    });
  }

  createCriterionFromSingleReference() {
    const filteredAttributes = this.filterReferencedOnlyOnceAttributes();
    filteredAttributes.forEach((reference) => {
      const referenceAttributeDefinition = reference.attributeDefinition;
      const singleReference = referenceAttributeDefinition.singleReference;
      this.createCriterionService
        .createCriterionFromTermCode(singleReference.termCodes, singleReference.context)
        .subscribe((referenceCriterion) => {
          this.referenceCriterionsList.push(referenceCriterion);
          if (this.referenceCriterionsList.length === filteredAttributes.length) {
            this.compareToLinkedCriteria();
            this.setReferenceCriterionsFromPreExistingReferenceCriterions();
          }
        });
    });
  }

  setReferenceCriterionsFromPreExistingReferenceCriterions() {
    this.preExistingReferenceCriterions.forEach((existingReference) => {
      // Check if the existing reference criterion already exists in the list
      const exists = this.referenceCriterionsList.some(
        (item) => item.criterionHash === existingReference.criterionHash
      );
      if (!exists && !existingReference.isLinked) {
        // If it doesn't exist, add it to the list
        this.referenceCriterionsList.push(existingReference);
      }
    });
  }

  /**
   * Get all Attributes which have the boolean 'referencedOnlyOnce' set
   *
   * @returns
   */
  filterReferencedOnlyOnceAttributes() {
    const filteredAttributes = this.referenceAttributes.filter((reference) => {
      const referenceAttributeDefinition = reference.attributeDefinition;
      return referenceAttributeDefinition.referencedOnlyOnce;
    });
    return filteredAttributes;
  }

  setReference(singleReferenceCriterion?: Criterion) {
    singleReferenceCriterion.isLinked = true;
    singleReferenceCriterion.entity = true;
    this.criterion.linkedCriteria.push(singleReferenceCriterion);
    this.query.groups[0].inclusionCriteria.push([singleReferenceCriterion]);
    this.setSelectableConceptsForCriterion(singleReferenceCriterion.context);
  }

  setSelectableConceptsForCriterion(referenceAttributeTermCode: TerminologyCode) {
    this.criterion.attributeFilters.forEach((attribureFilter) => {
      if (
        attribureFilter.type === FilterTypes.REFERENCE &&
        attribureFilter.attributeDefinition.singleReference?.context.display ===
          referenceAttributeTermCode.display
      ) {
        attribureFilter.selectedConcepts.push(referenceAttributeTermCode);
      }
    });
    this.moveReferenceCriteria();
  }

  deleteLinkedCriterion(singleReferenceCriterion: Criterion) {
    this.criterion.linkedCriteria.forEach((criteria, index) => {
      if (criteria.isLinked && criteria.uniqueID === singleReferenceCriterion.uniqueID) {
        criteria.isLinked = false;
        this.criterion.linkedCriteria.splice(index, 1);
        this.deselectAndRemoveConceptFromCriterion(singleReferenceCriterion.context);
      }
    });
    this.deleteCriterionFromQuery(singleReferenceCriterion);
  }

  /**
   * delete the criterion from the query and also the empty resukting group
   *
   * @param singleReferenceCriterion
   */
  deleteCriterionFromQuery(singleReferenceCriterion: Criterion): void {
    for (const inex of ['inclusion', 'exclusion']) {
      const criteriaKey = `${inex}Criteria` as 'inclusionCriteria' | 'exclusionCriteria';

      // Filter out the criteria matching the uniqueID and remove empty andGroups
      this.query.groups[0][criteriaKey] = this.query.groups[0][criteriaKey]
        .map((andGroup: Criterion[]) =>
          andGroup.filter(
            (criterion: Criterion) => criterion.uniqueID !== singleReferenceCriterion.uniqueID
          )
        )
        .filter((andGroup: Criterion[]) => andGroup.length > 0);
    }
    this.queryService.setFeasibilityQuery(this.query);
  }

  deselectAndRemoveConceptFromCriterion(referenceAttributeTermCode: TerminologyCode) {
    this.criterion.attributeFilters.forEach((attributeFilter) => {
      if (
        attributeFilter.type === FilterTypes.REFERENCE &&
        attributeFilter.attributeCode.display === referenceAttributeTermCode.display
      ) {
        const index = attributeFilter.selectedConcepts.findIndex(
          (concept) => concept.display === referenceAttributeTermCode.display
        );
        if (index !== -1) {
          attributeFilter.selectedConcepts.splice(index, 1); // Remove the concept at index
        }
      }
    });
    this.moveReferenceCriteria();
  }

  moveReferenceCriteria(): void {
    for (const inex of ['inclusion', 'exclusion']) {
      let x = 0;
      this.query.groups[0][inex + 'Criteria'].forEach((disj) => {
        let y = 0;
        disj.forEach((conj) => {
          if (conj.isLinked) {
            this.query.groups = CritGroupArranger.moveCriterionToEndOfGroup(
              this.query.groups,
              {
                groupId: conj.position.groupId,
                critType: conj.position.critType,
                column: conj.position.column - y,
                row: conj.position.row - x,
              },
              {
                groupId: conj.position.groupId,
                critType: conj.position.critType,
                column: -1,
                row: -1,
              }
            );
            if (disj.length === 1) {
              x++;
            }
            if (disj.length > 1) {
              y++;
            }
            this.rePosition();
          }
        });
      });
    }
  }
  rePosition(): void {
    for (const inex of ['inclusion', 'exclusion']) {
      this.query.groups[0][inex + 'Criteria'].forEach((disj, i) => {
        disj.forEach((conj, j) => {
          conj.position.row = i;
          conj.position.column = j;
        });
      });
    }
  }

  resetTimeRestriction() {
    this.criterion.timeRestriction = new TimeRestriction();
  }
}
