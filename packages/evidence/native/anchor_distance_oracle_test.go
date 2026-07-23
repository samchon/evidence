package evidence

import "testing"

// Verifies the banded anchor distance against an unbounded reference matrix.
//
// The production matcher trades a full matrix for a narrow band, and an
// off-by-one at either band edge could silently discard the correct quick fix.
// Exhaustive short strings cover insertions, deletions, substitutions, and
// adjacent transpositions in every position.
//
//  1. Generate every string through length five over a two-rune alphabet.
//  2. Compare bounded and reference distances under limits one through four.
//  3. Require exact results inside the band and rejection outside it.
func TestBoundedAnchorDistanceMatchesOracle(t *testing.T) {
	values := []string{""}
	for length := 1; length <= 5; length++ {
		values = append(values, binaryAnchorStrings("", length)...)
	}
	for _, left := range values {
		for _, right := range values {
			want := anchorDistanceOracle([]rune(left), []rune(right))
			for limit := 1; limit <= 4; limit++ {
				got := boundedAnchorDistance([]rune(left), []rune(right), limit)
				if want <= limit && got != want {
					t.Fatalf(
						"distance(%q, %q, limit %d) = %d, want %d",
						left,
						right,
						limit,
						got,
						want,
					)
				}
				if want > limit && got <= limit {
					t.Fatalf(
						"distance(%q, %q, limit %d) = %d, want rejection",
						left,
						right,
						limit,
						got,
					)
				}
			}
		}
	}
}

func binaryAnchorStrings(prefix string, remaining int) []string {
	if remaining == 0 {
		return []string{prefix}
	}
	return append(
		binaryAnchorStrings(prefix+"a", remaining-1),
		binaryAnchorStrings(prefix+"b", remaining-1)...,
	)
}

func anchorDistanceOracle(left []rune, right []rune) int {
	matrix := make([][]int, len(left)+1)
	for row := range matrix {
		matrix[row] = make([]int, len(right)+1)
		matrix[row][0] = row
	}
	for column := 0; column <= len(right); column++ {
		matrix[0][column] = column
	}
	for row := 1; row <= len(left); row++ {
		for column := 1; column <= len(right); column++ {
			substitutionCost := 1
			if left[row-1] == right[column-1] {
				substitutionCost = 0
			}
			matrix[row][column] = minimumAnchorCost(
				matrix[row-1][column]+1,
				matrix[row][column-1]+1,
				matrix[row-1][column-1]+substitutionCost,
			)
			if row > 1 &&
				column > 1 &&
				left[row-1] == right[column-2] &&
				left[row-2] == right[column-1] {
				transposed := matrix[row-2][column-2] + 1
				if transposed < matrix[row][column] {
					matrix[row][column] = transposed
				}
			}
		}
	}
	return matrix[len(left)][len(right)]
}
