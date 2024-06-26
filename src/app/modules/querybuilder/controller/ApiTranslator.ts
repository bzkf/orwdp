import { DataSelectionOnly, Query, QueryOnlyV1, QueryOnlyV2 } from '../model/api/query/query';
import { Criterion, CriterionOnlyV1, CriterionOnlyV2 } from '../model/api/query/criterion';
import { ObjectHelper } from './ObjectHelper';
import { Comparator, OperatorOptions } from '../model/api/query/valueFilter';
import { TimeRestrictionType } from '../model/api/query/timerestriction';
import { FeatureService } from 'src/app/service/Feature.service';
import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { TermEntry2CriterionTranslator } from './TermEntry2CriterionTranslator';

// translates a query with groups to the agreed format of queries in version 1 (without groups)
@Injectable({
  providedIn: 'root',
})
export class ApiTranslator {
  private readonly translator;
  constructor(public featureService: FeatureService) {
    this.translator = new TermEntry2CriterionTranslator(this.featureService.useFeatureTimeRestriction(), this.featureService.getQueryVersion());
  }
  translateToV1(query: Query): QueryOnlyV1 {
    const result = new QueryOnlyV1();

    if (query.display) {
      result.display = query.display;
    }
    const exclusionCriteria = ObjectHelper.clone(query.groups[0].exclusionCriteria);
    const inclusionCriteria = ObjectHelper.clone(query.groups[0].inclusionCriteria);

    result.inclusionCriteria = this.translateCritGroupV1(inclusionCriteria);

    if (exclusionCriteria.length > 0) {
      result.exclusionCriteria = this.translateCritGroupV1(exclusionCriteria);
    } else {
      result.exclusionCriteria = undefined;
    }

    return result;
  }

  private translateCritGroupV1(inclusionCriteria: Criterion[][]): CriterionOnlyV1[][] {
    const result: CriterionOnlyV1[][] = [];
    inclusionCriteria.forEach((criterionArray) => {
      const innerArrayV1: CriterionOnlyV1[] = [];
      criterionArray.forEach((criterion) => {
        const criterionV1 = new CriterionOnlyV1();
        criterionV1.termCode = criterion.termCodes[0];
        if (this.featureService.getSendSQContextToBackend()) {
          criterionV1.context = criterion.context;
        }
        criterionV1.timeRestriction = criterion.timeRestriction;
        if (criterion.valueFilters.length > 0) {
          criterionV1.valueFilter = criterion.valueFilters[0];
          criterionV1.valueFilter.valueDefinition = undefined;
        }

        this.removeNonApiFieldsV1(criterionV1);
        innerArrayV1.push(criterionV1);
      });
      result.push(innerArrayV1);
    });

    return result;
  }

  // noinspection JSMethodCanBeStatic
  private removeNonApiFieldsV1(criterion: CriterionOnlyV1): void {
    if (criterion.valueFilter) {
      // criterion.valueFilter.valueDefinition = null
      criterion.valueFilter.max = undefined;
      criterion.valueFilter.min = undefined;
      criterion.valueFilter.precision = undefined;

      if (criterion.valueFilter.type === OperatorOptions.CONCEPT) {
        criterion.valueFilter.comparator = undefined;
        criterion.valueFilter.maxValue = undefined;
        criterion.valueFilter.minValue = undefined;
        criterion.valueFilter.value = undefined;
        criterion.valueFilter.unit = undefined;
      } else if (criterion.valueFilter.type === OperatorOptions.QUANTITY_RANGE) {
        criterion.valueFilter.comparator = undefined;
        criterion.valueFilter.value = undefined;
        criterion.valueFilter.selectedConcepts = undefined;
        if (criterion.valueFilter.unit.code === '') {
          criterion.valueFilter.unit = undefined;
        }
      } else if (criterion.valueFilter.type === OperatorOptions.QUANTITY_COMPARATOR) {
        criterion.valueFilter.minValue = undefined;
        criterion.valueFilter.maxValue = undefined;
        criterion.valueFilter.selectedConcepts = undefined;
        if (criterion.valueFilter.unit.code === '') {
          criterion.valueFilter.unit = undefined;
        }
      }
    }
  }

  translateToV2(query: Query): QueryOnlyV2 {
    const result = new QueryOnlyV2();

    if (query.display) {
      result.display = query.display;
    }
    const exclusionCriteria = ObjectHelper.clone(query.groups[0].exclusionCriteria);
    const inclusionCriteria = ObjectHelper.clone(query.groups[0].inclusionCriteria);

    if (inclusionCriteria.length > 0) {
      result.inclusionCriteria = this.translateCritGroupV2(inclusionCriteria);
    } else {
      result.inclusionCriteria = [];
    }

    if (exclusionCriteria.length > 0) {
      result.exclusionCriteria = this.translateCritGroupV2(exclusionCriteria);
    } else {
      result.exclusionCriteria = undefined;
    }

    if (query.consent) {
      result.inclusionCriteria.push(this.getConsent());
    }
    return result;
  }

  translateForDataselection(query: Query) {
    const result = new DataSelectionOnly();
    const inclusionCriteria = ObjectHelper.clone(query.groups[0].inclusionCriteria);
    result.selectedCriteria = this.translateCritGroupV2(inclusionCriteria);
    result.selectedCriteria.forEach((criteria) => {
      criteria.forEach((criterion) => {
        delete criterion.valueFilter;
      });
    });
    return result;
  }

  private translateCritGroupV2(inclusionCriteria: Criterion[][]): CriterionOnlyV2[][] {
    const result: CriterionOnlyV2[][] = [];
    inclusionCriteria.forEach((criterionArray) => {
      const innerArrayV2: CriterionOnlyV2[] = [];
      criterionArray.forEach((criterion) => {
        if (criterion.isLinked === undefined || criterion.isLinked === false) {
          const criterionV2 = new CriterionOnlyV2();
          criterionV2.termCodes = criterion.termCodes;
          if (typeof criterion.requiredDataSelection === 'boolean') {
            criterionV2.requiredDataSelection = criterion.requiredDataSelection;
          }
          if (this.featureService.getSendSQContextToBackend()) {
            criterionV2.context = criterion.context;
          }
          criterionV2.timeRestriction = criterion.timeRestriction;
          if (criterion.valueFilters.length > 0) {
            criterionV2.valueFilter = criterion.valueFilters[0];
            criterionV2.valueFilter.valueDefinition = undefined;

            if (
              criterionV2.valueFilter.selectedConcepts !== undefined &&
              criterionV2.valueFilter.selectedConcepts.length === 0
            ) {
              criterionV2.valueFilter.selectedConcepts = undefined;
            }

            if (
              (criterionV2.valueFilter.comparator === Comparator.NONE ||
                criterionV2.valueFilter.comparator === undefined) &&
              criterionV2.valueFilter.selectedConcepts === undefined
            ) {
              criterionV2.valueFilter = undefined;
            }
          }
          if (criterion.attributeFilters?.length > 0) {
            criterion.attributeFilters.forEach((attribute) => {
              if (attribute.type === OperatorOptions.CONCEPT) {
                if (attribute.selectedConcepts.length > 0) {
                  criterionV2.attributeFilters.push(attribute);
                }
              } else {
                if (attribute.type === OperatorOptions.REFERENCE) {
                  if (criterion.linkedCriteria.length > 0) {
                    const refAttribute = attribute;
                    delete refAttribute.selectedConcepts;
                    refAttribute.criteria = [];
                    criterion.linkedCriteria.forEach((linkedCrit) => {
                      const newLinkedCrit = new CriterionOnlyV2();
                      newLinkedCrit.termCodes = linkedCrit.termCodes;
                      newLinkedCrit.context = linkedCrit.context;
                      if (linkedCrit.attributeFilters.length > 0) {
                        newLinkedCrit.attributeFilters = linkedCrit.attributeFilters;
                      } else {
                        delete newLinkedCrit.attributeFilters;
                      }
                      if (linkedCrit.valueFilters.length > 0) {
                        newLinkedCrit.valueFilter = linkedCrit.valueFilters[0];
                      } else {
                        delete newLinkedCrit.valueFilter;
                      }
                      delete newLinkedCrit.children;
                      delete newLinkedCrit.linkedCriteria;
                      this.removeNonApiFieldsV2(newLinkedCrit);
                      refAttribute.criteria.push(newLinkedCrit);
                    });
                    criterionV2.attributeFilters.push(refAttribute);
                  }
                } else {
                  criterionV2.attributeFilters.push(attribute);
                }
              }
              attribute.attributeCode = attribute.attributeDefinition?.attributeCode;

              if (attribute.attributeCode.version === null) {
                attribute.attributeCode.version = undefined;
              }
            });
          }
          this.editTimeRestrictionsV2(criterionV2);
          this.removeNonApiFieldsV2(criterionV2);
          innerArrayV2.push(criterionV2);
        }
      });
      if (innerArrayV2.length > 0) {
        result.push(innerArrayV2);
      }
    });

    return result;
  }

  // noinspection JSMethodCanBeStatic
  private removeNonApiFieldsV2(criterion: CriterionOnlyV2): void {
    if (criterion.valueFilter) {
      criterion.valueFilter.valueDefinition = undefined;
      criterion.valueFilter.precision = undefined;
      if (criterion.valueFilter.type === OperatorOptions.QUANTITY_COMPARATOR) {
        criterion.valueFilter.min = undefined;
        criterion.valueFilter.max = undefined;
        criterion.valueFilter.minValue = undefined;
        criterion.valueFilter.maxValue = undefined;
        criterion.valueFilter.unit = {
          code: criterion.valueFilter.unit.code,
          display: criterion.valueFilter.unit.display,
        };
      }
      if (criterion.valueFilter.type === OperatorOptions.QUANTITY_RANGE) {
        criterion.valueFilter.comparator = undefined;
        criterion.valueFilter.value = undefined;
        criterion.valueFilter.min = undefined;
        criterion.valueFilter.max = undefined;
        criterion.valueFilter.unit = {
          code: criterion.valueFilter.unit.code,
          display: criterion.valueFilter.unit.display,
        };
      }
    }
    if (criterion.attributeFilters?.length > 0) {
      criterion.attributeFilters.forEach((attribute) => {
        attribute.min = undefined;
        attribute.max = undefined;
        attribute.attributeDefinition = undefined;
        attribute.precision = undefined;

        if (attribute.type === OperatorOptions.QUANTITY_COMPARATOR) {
          attribute.minValue = undefined;
          attribute.maxValue = undefined;
          attribute.unit = { code: attribute.unit.code, display: attribute.unit.display };
        }
        if (attribute.type === OperatorOptions.QUANTITY_RANGE) {
          attribute.comparator = undefined;
          attribute.value = undefined;
          attribute.unit = { code: attribute.unit.code, display: attribute.unit.display };
        }
      });

      criterion.attributeFilters = criterion.attributeFilters.filter((attrFilter, i) => attrFilter.type !== undefined);
    }

    if (criterion.attributeFilters?.length === 0) {
      criterion.attributeFilters = undefined;
    }

    if (criterion.children) {
      delete criterion.children;
    }
    if (criterion.linkedCriteria) {
      delete criterion.linkedCriteria;
    }
    if (criterion.termCodes[0].uid) {
      delete criterion.termCodes[0].uid;
    }
  }

  // noinspection JSMethodCanBeStatic
  private editTimeRestrictionsV2(criterion: CriterionOnlyV2): void {
    if (criterion.timeRestriction) {
      if (criterion.timeRestriction.minDate) {
        const minTemp = new Date(criterion.timeRestriction.minDate);
        const maxTemp = new Date(criterion.timeRestriction.maxDate);
        const offset = minTemp.getTimezoneOffset() / -60;
        minTemp.setHours(23 + offset, 59, 59, 999);
        maxTemp.setHours(offset, 0, 0, 0);

        switch (criterion.timeRestriction.tvpe) {
          case TimeRestrictionType.AFTER: {
            // minTemp.setDate(minTemp.getDate() + 1)
            criterion.timeRestriction.afterDate = minTemp.toISOString().split('T')[0];
            criterion.timeRestriction.beforeDate = undefined;
            break;
          }
          /*case TimeRestrictionType.AFTER_OR_AT: {
            criterion.timeRestriction.afterDate = minTemp.toISOString().split("T")[0]
            criterion.timeRestriction.beforeDate = undefined
            break
          }*/
          case TimeRestrictionType.BEFORE: {
            // minTemp.setDate(minTemp.getDate() - 1)
            criterion.timeRestriction.beforeDate = minTemp.toISOString().split('T')[0];
            criterion.timeRestriction.afterDate = undefined;
            break;
          }
          /*case TimeRestrictionType.BEFORE_OR_AT: {
            criterion.timeRestriction.beforeDate = minTemp.toISOString().split("T")[0]
            criterion.timeRestriction.afterDate = undefined
            break
          }*/
          case TimeRestrictionType.AT: {
            criterion.timeRestriction.beforeDate = minTemp.toISOString().split('T')[0];
            criterion.timeRestriction.afterDate = minTemp.toISOString().split('T')[0];
            break;
          }
          /*case TimeRestrictionType.NOT_AT: {
            minTemp.setDate(minTemp.getDate() - 1)
            criterion.timeRestriction.beforeDate = minTemp.toISOString().split("T")[0]
            minTemp.setDate(minTemp.getDate() + 2)
            criterion.timeRestriction.afterDate = minTemp.toISOString().split("T")[0]
            break
          }*/
          case TimeRestrictionType.BETWEEN: {
            if (criterion.timeRestriction.maxDate) {
              criterion.timeRestriction.beforeDate = maxTemp.toISOString().split('T')[0];
              criterion.timeRestriction.afterDate = minTemp.toISOString().split('T')[0];
            } else {
              criterion.timeRestriction = undefined;
            }
            break;
          }
        }
      } else {
        criterion.timeRestriction = undefined;
      }
      if (criterion.timeRestriction) {
        criterion.timeRestriction.tvpe = undefined;
        criterion.timeRestriction.minDate = undefined;
        criterion.timeRestriction.maxDate = undefined;
      }
    }
  }

  translateImportedDsToUIQuery(uiquery: Query, sqquery: any): Query {
    const invalidCriteria = [];
    const selectedCriteria = sqquery.selectedCriteria ? sqquery.selectedCriteria : [];
    uiquery.groups[0].inclusionCriteria = this.translateSQtoUICriteria(selectedCriteria, invalidCriteria);
    delete uiquery.groups[0].selectedCriteria;
    return uiquery;
  }

  translateImportedSQtoUIQuery(uiquery: Query, sqquery: any): Query {
    const invalidCriteria = [];
    const inclusion = sqquery.inclusionCriteria ? sqquery.inclusionCriteria : [];
    uiquery.groups[0].inclusionCriteria = this.translateSQtoUICriteria(inclusion, invalidCriteria);
    const exclusion = sqquery.exclusionCriteria ? sqquery.exclusionCriteria : [];
    uiquery.groups[0].exclusionCriteria = this.translateSQtoUICriteria(exclusion, invalidCriteria);
    uiquery.consent = this.hasConsentAndIfSoDeleteIt(sqquery);
    uiquery = this.rePosition(uiquery);
    return uiquery;
  }

  translateSQtoUIQuery(uiquery: Query, sqquery: any): Query {
    const invalidCriteria = sqquery.invalidTerms;
    const inclusion = sqquery.content.inclusionCriteria ? sqquery.content.inclusionCriteria : [];
    uiquery.groups[0].inclusionCriteria = this.translateSQtoUICriteria(inclusion, invalidCriteria);
    const exclusion = sqquery.content.exclusionCriteria ? sqquery.content.exclusionCriteria : [];
    uiquery.groups[0].exclusionCriteria = this.translateSQtoUICriteria(exclusion, invalidCriteria);
    uiquery.consent = this.hasConsentAndIfSoDeleteIt(sqquery.content);
    uiquery = this.rePosition(uiquery);
    return uiquery;
  }

  private translateSQtoUICriteria(inexclusion, invalidCriteria): any {
    const invalidCriteriaSet: Set<string> = new Set();
    invalidCriteria.forEach((invalids) => {
      invalidCriteriaSet.add(JSON.stringify(invalids));
    });

    // eslint-disable-next-line  @typescript-eslint/prefer-for-of
    for (let i = 0; i < inexclusion.length; i++) {
      inexclusion[i].forEach((or, j) => {
        or.valueFilters = [];
        if (or.valueFilter) {
          or.valueFilters.push(or.valueFilter);
          or.valueFilter = undefined;
          if (or.valueFilters[0].type === 'quantity-range') {
            or.valueFilters[0].value = 0;
            or.valueFilters[0].precision = 1;
            or.valueFilters[0].comparator = 'bw';
          }
          if (or.valueFilters[0].type === 'quantity-comparator') {
            or.valueFilters[0].precision = 1;
          }
        }
        if (!or.attributeFilters) {
          or.attributeFilters = [];
        }
        if (!or.linkedCriteria) {
          or.linkedCriteria = [];
        }
        or.attributeFilters.forEach((attribute) => {
          attribute.attributeDefinition = {};
          attribute.attributeDefinition.attributeCode = ObjectHelper.clone(attribute.attributeCode);
          delete attribute.attributeCode;
          if (attribute.type === 'quantity-range') {
            attribute.value = 0;
            attribute.precision = 1;
            attribute.comparator = 'bw';
          }
          if (attribute.type === 'quantity-comparator') {
            attribute.precision = 1;
          }
          if (attribute.type === 'reference') {
            attribute.attributeDefinition.type = 'reference';
            attribute.attributeDefinition.selectableConcepts = [];
            attribute.criteria.forEach((refCrit) => {
              refCrit.isLinked = true;
              refCrit.uniqueID = uuidv4();
              refCrit.criterionHash = this.translator.getCriterionHash(refCrit);
              refCrit.termCodes[0].uid = refCrit.uniqueID;
              attribute.attributeDefinition.selectableConcepts.push(refCrit.termCodes[0]);
              attribute.attributeDefinition.optional = true;
              or.linkedCriteria.push(refCrit);
              inexclusion.push([refCrit]);
            });
            delete attribute.criteria;
          }
        });
        or.display = or.termCodes[0].display;
        or.children = [];
        if (or.timeRestriction) {
          let type: TimeRestrictionType;
          if (or.timeRestriction.afterDate && or.timeRestriction.beforeDate) {
            if (or.timeRestriction.beforeDate === or.timeRestriction.afterDate) {
              type = TimeRestrictionType.AT;
            } else {
              type = TimeRestrictionType.BETWEEN;
            }
          }
          if (or.timeRestriction.afterDate && !or.timeRestriction.beforeDate) {
            type = TimeRestrictionType.AFTER;
          }
          if (!or.timeRestriction.afterDate && or.timeRestriction.beforeDate) {
            type = TimeRestrictionType.BEFORE;
            or.timeRestriction.afterDate = or.timeRestriction.beforeDate;
          }
          or.timeRestriction = {
            tvpe: type,
            minDate: or.timeRestriction.afterDate ? new Date(or.timeRestriction.afterDate) : undefined,
            maxDate: or.timeRestriction.beforeDate ? new Date(or.timeRestriction.beforeDate) : undefined,
          };
        }
        or.isinvalid = invalidCriteriaSet.has(JSON.stringify(or.termCodes[0]));
        or.position = { groupId: 1, critType: '', row: i, column: j };
        or.criterionHash = this.translator.getCriterionHash(or);
      });
    }
    return inexclusion;
  }

  private getConsent(): CriterionOnlyV2[] {
    return [
      {
        context: {
          code: 'Einwilligung',
          display: 'Einwilligung',
          system: 'fdpg.mii.cds',
          version: '1.0.0',
        },
        termCodes: [
          {
            code: '2.16.840.1.113883.3.1937.777.24.5.3.8',
            display: 'MDAT wissenschaftlich nutzen EU DSGVO NIVEAU',
            system: 'urn:oid:2.16.840.1.113883.3.1937.777.24.5.3',
          },
        ],
      },
    ];
  }

  private hasConsentAndIfSoDeleteIt(sqquery: any): boolean {
    let consent = false;
    let index = [undefined, undefined];
    if (sqquery.inclusionCriteria) {
      sqquery.inclusionCriteria.forEach((and, indexAnd) => {
        and.forEach((or, indexOr) => {
          if (
            or.termCodes[0].code === '2.16.840.1.113883.3.1937.777.24.5.3.8' &&
            or.termCodes[0].system === 'urn:oid:2.16.840.1.113883.3.1937.777.24.5.3'
          ) {
            consent = true;
            index = [indexAnd, indexOr];
          }
        });
      });
    }

    /* HOTFIX fix: Do not delete and instead display choice explicitedly
     * Should be reviewed
    if (index[0] !== undefined && index[1] !== undefined) {
      sqquery.inclusionCriteria[index[0]].splice(index[1], 1);
      if (sqquery.inclusionCriteria[index[0]].length === 0) {
        sqquery.inclusionCriteria.splice(index[0], 1);
      }
    }*/
    return consent;
  }

  rePosition(query: Query): Query {
    for (const inex of ['inclusion', 'exclusion']) {
      query.groups[0][inex + 'Criteria'].forEach((disj, i) => {
        disj.forEach((conj, j) => {
          conj.position.row = i;
          conj.position.column = j;
          conj.position.critType = inex;
          if (conj.isLinked) {
            this.setPositionForRefCrit(query, conj.uniqueID, i, j, inex);
          }
        });
      });
    }
    return query;
  }

  setPositionForRefCrit(query: Query, uid: string, row: number, column: number, critType: string): Query {
    for (const inex of ['inclusion', 'exclusion']) {
      query.groups[0][inex + 'Criteria'].forEach((disj) => {
        disj.forEach((conj) => {
          if (conj.linkedCriteria?.length > 0) {
            conj.linkedCriteria.forEach((linkedCrit) => {
              if (linkedCrit.uniqueID === uid) {
                linkedCrit.position.row = row;
                linkedCrit.position.column = column;
                linkedCrit.position.critType = critType;
              }
            });
          }
        });
      });
    }
    return query;
  }
}
