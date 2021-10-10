export const visu = results => {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: {
      values: results,
    },
    transform: [
      {
        fold: [
          "nest_quality_assessment_error",
          "percentage_foragers",
          "number_nests",
          "exploring_phase",
        ],
        as: ["parameter", "value"]
      },
      {
        density: "value",
        groupby: ["colony_id", "parameter"],
      }
    ],
    facet: {
      row: {
        field: "colony_id",
        align: "none",
      },
      column: {
        field: "parameter",
        sort: [
          "nest_quality_assessment_error",
          "percentage_foragers",
          "number_nests",
          "exploring_phase"
        ],
        header: {
          titleOrient: "bottom",
          labelOrient: "bottom",
        }
      }
    },
    spec: {
      width:100,
      height: 60,
      mark: 'line',
      encoding: {
        y: {
          field: 'density',
          type: 'quantitative',
        },
        x: {
          field: 'value',
          type: 'quantitative',
        }
      }
    },
    resolve: {scale: {x: "independent", y: "independent"}},
    config: {
      facet: {
        spacing: 5,
      }
    },
  }
};

