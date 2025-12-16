import matplotlib.pyplot as plt
import numpy as np

def generate_synthetic_data():
    """
    Generates synthetic data approximating the distribution in the image.
    Returns a dictionary with keys 'mutant' and 'wildtype', each containing
    a list of arrays for the 4 timepoints.
    """
    np.random.seed(42)
    
    # Parameters estimated from visual analysis
    # Format: (mean, std, count)
    params = {
        'mutant': [
            (42, 5, 60),  # E8.5
            (50, 7, 65),  # E9.5
            (55, 10, 70), # E10.5
            (58, 6, 60)   # E11.5
        ],
        'wildtype': [
            (46, 6, 60),  # E8.5
            (64, 10, 75), # E9.5
            (79, 9, 80),  # E10.5
            (84, 8, 70)   # E11.5
        ]
    }
    
    data = {'mutant': [], 'wildtype': []}
    
    for group in ['mutant', 'wildtype']:
        for (mean, std, count) in params[group]:
            # Generate normal distribution
            points = np.random.normal(mean, std, count)
            # Clip to realistic bounds based on plot (e.g. no negative lengths)
            points = np.clip(points, 25, 115)
            data[group].append(points)
            
    return data

def add_jitter(x_center, n_points, width=0.2):
    """Generates jittered x-coordinates for strip plot."""
    return np.random.uniform(x_center - width/2, x_center + width/2, n_points)

def plot_figure():
    # 1. Setup Figure and Axes
    fig, ax = plt.subplots(figsize=(6, 5.5), facecolor='white')
    
    # 2. Generate Data
    data = generate_synthetic_data()
    stages = ['E8.5', 'E9.5', 'E10.5', 'E11.5']
    x_centers = np.arange(1, 5)
    
    # 3. Define Colors and Styles
    color_mutant = '#E8A03E'  # Muted orange
    color_wildtype = '#958AC5' # Muted lavender
    
    box_width = 0.35
    spacing = 0.2
    
    # Positions: Mutant on left, Wildtype on right of the tick
    pos_mutant = x_centers - spacing
    pos_wildtype = x_centers + spacing
    
    # 4. Plotting Loop
    # We plot boxplots and scatter points for each group
    
    # --- MUTANT GROUP ---
    # Boxplot
    bp_mut = ax.boxplot(data['mutant'], positions=pos_mutant, widths=box_width, 
                        patch_artist=True, showfliers=False,
                        medianprops={'color': 'black', 'linewidth': 1.5},
                        boxprops={'facecolor': color_mutant, 'edgecolor': '#333333', 'linewidth': 1},
                        whiskerprops={'color': '#333333', 'linewidth': 1},
                        capprops={'color': '#333333', 'linewidth': 1})
    
    # Scatter (Strip plot)
    for i, points in enumerate(data['mutant']):
        x_jittered = add_jitter(pos_mutant[i], len(points), width=box_width*0.6)
        ax.scatter(x_jittered, points, s=25, facecolor=color_mutant, 
                   edgecolor='black', linewidth=0.5, alpha=0.6, zorder=3)

    # --- WILDTYPE GROUP ---
    # Boxplot
    bp_wt = ax.boxplot(data['wildtype'], positions=pos_wildtype, widths=box_width, 
                       patch_artist=True, showfliers=False,
                       medianprops={'color': 'black', 'linewidth': 1.5},
                       boxprops={'facecolor': color_wildtype, 'edgecolor': '#333333', 'linewidth': 1},
                       whiskerprops={'color': '#333333', 'linewidth': 1},
                       capprops={'color': '#333333', 'linewidth': 1})
    
    # Scatter (Strip plot)
    for i, points in enumerate(data['wildtype']):
        x_jittered = add_jitter(pos_wildtype[i], len(points), width=box_width*0.6)
        ax.scatter(x_jittered, points, s=25, facecolor=color_wildtype, 
                   edgecolor='black', linewidth=0.5, alpha=0.6, zorder=3)

    # 5. Axes Formatting
    ax.set_xticks(x_centers)
    ax.set_xticklabels(stages, fontsize=12, fontfamily='sans-serif')
    ax.set_xlim(0.2, 4.8)
    
    ax.set_ylim(20, 120)
    ax.set_yticks(np.arange(20, 121, 20))
    ax.tick_params(axis='both', which='major', labelsize=11, direction='in', length=4)
    
    # Labels
    ax.set_ylabel('tracheal length (μm)', fontsize=14, fontfamily='sans-serif', labelpad=10)
    ax.set_xlabel('developmental stage (days)', fontsize=14, fontfamily='sans-serif', labelpad=8)
    
    # Spines (Classic scientific style)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(1.0)
    ax.spines['bottom'].set_linewidth(1.0)
    
    # 6. Legend
    # Create custom handles for the legend to match the square markers in the original
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], marker='s', color='w', label='mutant',
               markerfacecolor=color_mutant, markeredgecolor='black', markersize=6, markeredgewidth=0.5),
        Line2D([0], [0], marker='s', color='w', label='wildtype',
               markerfacecolor=color_wildtype, markeredgecolor='black', markersize=6, markeredgewidth=0.5)
    ]
    
    ax.legend(handles=legend_elements, loc='upper left', frameon=False, 
              fontsize=9, handletextpad=0.2, borderaxespad=0.5)

    # 7. Figure Label "C"
    # Placed in figure coordinates to be outside the axes
    fig.text(0.02, 0.92, 'C', fontsize=20, fontweight='bold', fontfamily='sans-serif')

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    plot_figure()